# MyASA 2.0 — Pesquisa UX: Jornada do Membro

> Versão: 17/06/2026
> Origem: Entrevista estruturada — fase pré-design
> Status: Aprovado para uso em UX e Design System

---

## Síntese em Uma Frase

> O trabalho do Membro não é gerenciar a operação. É executar corretamente a sua parte dela — e para isso, ele precisa de clareza constante sobre o que deve fazer, o que mudou, e se o que entregou foi suficiente.

---

## Contraste Central com o Supervisor

| Dimensão | Supervisor | Membro |
|---|---|---|
| Pergunta do dia | "O que mudou na operação?" | "O que eu preciso fazer hoje?" |
| Perspectiva | A operação inteira | Sua parte dentro da operação |
| Principal risco | Exceção não percebida | Mudança não recebida a tempo |
| Fonte de ansiedade | Operação desprotegida | Incerteza sobre o que é esperado |
| Fonte de confiança | Controle do status da operação | Um lugar único e confiável para consultar |
| Relação com a IA | Gerenciar a operação | Interpretar a operação para si mesmo |

---

## Descobertas Fundamentais

### D1 — O Membro busca segurança, não informação

**Resposta Operacional:**
A primeira ação do Membro ao abrir o produto não é descobrir novidades. É confirmar o que já acredita saber. A pergunta central é: *"O que eu preciso fazer hoje?"* — seguida imediatamente de: *"Mudou alguma coisa?"*

**Impacto Operacional:**
Em dias normais existe uma expectativa de certeza. Mas existe sempre uma dúvida silenciosa: *"Será que mudou alguma coisa?"* Essa dúvida é universal em operações artísticas dinâmicas. O Membro não procura novidades — procura confirmação.

**Impacto para UX:**
O Meu Dia não deve começar mostrando tudo. Deve começar respondendo imediatamente *"O que preciso fazer hoje?"* e logo depois *"O que mudou?"*. Essa ordem reflete exatamente o processo mental do Membro: primeiro orientação, depois confirmação.

**Impacto para Interface:**
- Primeira camada: Meu Próximo Compromisso (show, ensaio, aula, reunião)
- Segunda camada: Alterações Recentes (o que mudou desde a última vez que o Membro abriu o app)
- Terceira camada: Meu Dia Completo (linha do tempo, horários, local, função, personagem)
- Nenhuma dessas camadas deve parecer uma escala administrativa ou agenda corporativa
- A sensação deve ser: *"Eu sei exatamente o que preciso fazer"*

**Riscos:**
Transformar o Meu Dia em uma versão resumida da Escala do Supervisor. O Membro não quer ver a operação inteira — quer ver a parte da operação que depende dele. Mostrar informação demais aumenta ansiedade, não aumenta confiança.

**Oportunidade para IA:**
A IA do Membro atua como intérprete pessoal da operação: *"Hoje você tem Musical às 12h30 como Astrid, Show de Patinação às 14h00 e não houve alterações desde a última publicação."* Traduz complexidade operacional em clareza pessoal.

---

### D2 — Mudanças são mais importantes que a programação

**Resposta Operacional:**
O Membro já tem uma expectativa sobre o que vai acontecer. O que ele precisa saber com urgência não é a programação — é o que mudou nela. Mudanças de personagem, horário, atividade ou substituição são as informações de maior prioridade.

**Impacto Operacional:**
Uma mudança não comunicada adequadamente pode gerar o mesmo impacto de uma ausência. A pessoa está fisicamente presente, mas operacionalmente desinformada. Chega com o figurino errado, prepara o personagem errado, perde um ensaio, gera impacto operacional sem intenção — e sem culpa.

**Impacto para UX:**
O sistema não deve apenas mostrar a programação atual. Deve destacar claramente o que mudou desde a última vez que o Membro consultou. Essa comparação deve ser feita pelo sistema, não pelo Membro. Ele não deve precisar comparar Livro antigo com Livro novo — o sistema faz isso por ele.

**Impacto para Interface:**
- Alterações recentes devem ser destacadas visualmente no Meu Dia — não apenas disponíveis como notificações
- Uma mudança operacional importante deve permanecer visível até que o Membro a reconheça — não basta enviar, é necessário garantir compreensão
- Notificações desaparecem; mudanças operacionais não

**Riscos:**
Tratar alterações como simples notificações. Notificações têm vida curta e desaparecem do contexto. Uma mudança de personagem às 11h para um show às 12h não pode ser apenas um push notification — precisa estar visível e destacada no momento em que o Membro abrir o produto.

**Oportunidade para IA:**
A IA pode atuar como tradutora de mudanças: *"O que mudou hoje?"* → *"Você recebeu um novo ensaio às 16h e foi designada para Mensageira no Musical."* Reduz a necessidade de o Membro interpretar listas de alterações.

---

### D3 — O silêncio sem significado é a pior experiência

**Resposta Operacional:**
Depois de enviar uma solicitação, fazer uma entrega ou aguardar uma resposta, o Membro entra em estado de incerteza. O silêncio não tem significado claro: pode ser que não foi lido, que está sendo analisado, que foi esquecido, ou que foi negado. A ausência de estado gera ansiedade mesmo quando ninguém fez nada errado.

**Impacto Operacional:**
O comportamento padrão frente ao silêncio é criar mecanismos paralelos: perguntar novamente, mandar outra mensagem, procurar o Supervisor pessoalmente, buscar confirmação informal com colegas. Isso gera retrabalho para todos e pressão desnecessária sobre os Supervisores.

**Impacto para UX:**
O Membro não precisa de resposta imediata. Precisa de estado visível. A diferença é fundamental: velocidade não é o que gera confiança — previsibilidade sim. Saber que existe um fluxo definido — enviado → recebido → em análise → decidido — reduz a ansiedade independente do tempo que leva.

**Impacto para Interface:**
Toda entidade que passa por análise (Solicitação, Entrega, Aviso com confirmação) deve exibir seu estado atual de forma proeminente, sem necessidade de abrir o item individualmente. O Membro deve conseguir responder em um olhar: *"Qual é a situação atual dos meus pedidos e entregas?"*

**Riscos:**
Reproduzir dentro do produto o mesmo problema do WhatsApp: mensagem enviada → silêncio. Se o MyASA não resolver o problema do estado visível, ele apenas muda de canal — não resolve nada.

**Oportunidade para IA:**
*"Qual o status da minha solicitação de folga?"* → *"Sua solicitação para o dia 15 está em análise pelo Supervisor responsável."* A IA elimina a necessidade de perguntar para uma pessoa o que o sistema já sabe.

---

### D4 — Solicitações são processos de acompanhamento, não formulários de envio

**Resposta Operacional:**
Na prática, pedidos nascem como conversas informais: *"Posso folgar dia 15?"*, *"Será que alguém consegue trocar comigo?"*, *"Machuquei o tornozelo."* O pedido existe naturalmente como diálogo, não como formulário. O desafio do produto é formalizar sem perder naturalidade.

**Impacto Operacional:**
O valor de uma Solicitação não termina quando ela é criada — começa aí. O período de espera pode durar dias. Solicitações mal acompanhadas geram mensagens duplicadas, interrupções no Supervisor e perda de confiança no processo. Em casos extremos o Membro abandona o sistema e volta para o WhatsApp.

**Impacto para UX:**
O UX deve dar mais atenção ao acompanhamento do que ao preenchimento. Criar uma solicitação leva segundos. Esperar uma resposta pode levar dias. O design da tela de Solicitações deve refletir isso: ela é um painel de acompanhamento, não uma caixa de formulários enviados.

**Impacto para Interface:**
- Primeira camada: Solicitações em andamento (em análise, aguardando resposta, necessita ação)
- Segunda camada: Decisões recentes (aprovadas, negadas, alteradas com motivo)
- Terceira camada: Histórico completo
- Quando uma solicitação é negada: o motivo deve ser visível e explicado — a sensação de justiça está na explicação, não apenas no resultado

**Riscos:**
Focar o design na criação da solicitação em detrimento do acompanhamento. A etapa de criação pode ser simples e rápida — o esforço de design deve ir para o estado pós-envio.

**Oportunidade para IA:**
*"Por que minha solicitação foi negada?"* → *"A folga foi negada porque existem apenas dois membros habilitados para essa função e ambos são necessários para a operação daquele dia."* A IA transforma decisões em entendimento.

---

### D5 — Entregas são ciclos, não eventos isolados

**Resposta Operacional:**
O maior problema de uma entrega raramente é esquecer de fazê-la. É não ter certeza do que significa *"fazer certo"*. Formato, duração, critério de qualidade, prazo real, quem avalia — essas informações frequentemente chegam incompletas. O Membro entende que existe a tarefa, mas não entende completamente a expectativa.

**Impacto Operacional:**
Entregas mal definidas geram: dúvidas repetidas, retrabalho, atrasos involuntários, avaliações inconsistentes. Em muitos casos a operação perde mais tempo esclarecendo expectativas do que executando a tarefa. O fluxo real de uma entrega frequentemente é: criar → analisar → solicitar ajuste → reentregar → aprovar.

**Impacto para UX:**
A parte mais importante de uma Entrega não é o envio — é a clareza. O UX deve priorizar: Objetivo → Prazo → Critério → Status → Feedback. A entrega começa quando uma expectativa é criada, não quando o arquivo é enviado. E só termina quando existe clareza de que essa expectativa foi atendida.

**Impacto para Interface:**
- Área de Entregas deve parecer uma jornada de acompanhamento, não um repositório de arquivos
- Primeira camada: Pendentes (com prazo e prioridade visíveis)
- Segunda camada: Em análise (aguardando avaliação)
- Terceira camada: Feedbacks e ajustes (comentários, correções, próximos passos)
- Quarta camada: Concluídas
- O foco não é o arquivo — é a evolução da entrega

**Riscos:**
Transformar Entregas em uma área de upload. Isso resolve apenas a parte menos importante do problema. O verdadeiro desafio é visibilidade de expectativa e estado — não armazenamento de arquivos.

**Oportunidade para IA:**
*"O que exatamente esperam desta entrega?"*, *"Meu envio já foi analisado?"*, *"Existe algum feedback pendente?"*, *"Resuma o que preciso fazer para concluir esta entrega."* A IA reduz ambiguidades antes que se transformem em erros.

---

### D6 — O Membro procura pessoas antes de procurar informação

**Resposta Operacional:**
Quando surge uma dúvida rápida — que personagem faz hoje, qual o horário, qual o prazo da entrega — o comportamento mais comum não é buscar no sistema. É perguntar para alguém. Não porque as pessoas são fontes melhores, mas porque encontrar a informação muitas vezes é mais difícil do que encontrar alguém.

**Impacto Operacional:**
Quanto mais o Membro depende de comunicação informal, maior o risco de interpretações diferentes, informações desatualizadas, dúvidas repetidas e dependência excessiva dos Supervisores. A operação se torna mais lenta — não por falta de informação, mas porque ela não está centralizada e acessível.

**Impacto para UX:**
O produto não deve competir com a comunicação humana. O objetivo não é impedir que as pessoas conversem — é reduzir a necessidade de conversar para descobrir fatos. As pessoas devem conversar para colaborar, não para descobrir qual é a programação correta. A experiência ideal: antes de abrir uma conversa, o Membro consegue encontrar a resposta sozinho.

**Impacto para Interface:**
Essa descoberta afeta diretamente todos os pilares:
- Meu Dia: deve responder dúvidas sobre hoje sem precisar perguntar
- Biblioteca: deve responder dúvidas sobre conhecimento sem precisar perguntar
- Entregas: deve responder dúvidas sobre expectativas sem precisar perguntar
- Solicitações: deve responder dúvidas sobre status sem precisar perguntar
- IA: deve ser o primeiro lugar onde o Membro procura uma resposta contextual

**Riscos:**
Transformar o MyASA em apenas mais um lugar para trocar mensagens. Se isso acontecer, ele se torna uma versão pior do WhatsApp. O produto gera valor quando reduz perguntas repetidas — não quando cria novos canais para fazê-las.

**Oportunidade para IA:**
A IA pode se tornar o primeiro lugar onde o Membro busca respostas contextuais antes de perguntar para alguém. Para isso precisa estar conectada a todos os pilares: Meu Dia, Escala, Entregas, Solicitações, Livros, Biblioteca. A IA deixa de ser uma ferramenta isolada e passa a ser o ponto único de consulta da operação.

---

### D7 — Aviso e Mensagem têm propósitos mentais distintos

**Resposta Operacional:**
Na percepção do Membro, Aviso e Mensagem têm significados diferentes antes mesmo de serem lidos. Um Aviso significa: *"Isso é importante para várias pessoas."* Uma Mensagem significa: *"Isso tem relação comigo."* O canal define a expectativa de como processar o conteúdo.

**Impacto Operacional:**
Quando ambos os canais parecem iguais, o Membro perde a capacidade de triagem rápida. Uma mudança operacional urgente enterrada entre mensagens de conversa tem alta chance de passar despercebida. A diferença de canal é uma diferença de prioridade e modo de leitura.

**Impacto para UX:**
Aviso espera compreensão — é unidirecional, comunica um fato ou diretriz. Mensagem espera interação — é contextual, permite conversa. Essas duas experiências precisam ser visualmente e funcionalmente distintas. O Membro não deve precisar ler o conteúdo para entender qual tipo de atenção o item exige.

**Impacto para Interface:**
- 📢 Avisos: comunicação para grupos, unidirecional, foco em conhecimento, não exigem resposta, exigem confirmação de leitura quando relevante
- 💬 Mensagens: comunicação entre pessoas, bidirecional, foco em interação, permitem conversa
- Os dois tipos devem ser claramente separados — visual, hierárquico e funcionalmente

**Riscos:**
Unificar Avisos e Mensagens em uma única área de comunicação. Isso faz com que o Membro precise processar cada item individualmente para entender o que exige dele — exatamente o problema que o produto deve resolver.

**Oportunidade para IA:**
A IA pode resumir Avisos não lidos: *"Desde ontem você recebeu 3 avisos. O mais importante: ensaio extra confirmado para quinta."* Reduz a carga de leitura sem eliminar o conteúdo.

---

### D8 — A IA do Membro é um intérprete pessoal, não um gestor operacional

**Resposta Operacional:**
O Supervisor usa a IA para gerenciar a operação. O Membro usa a IA para entender sua parte na operação. As perguntas são completamente diferentes: o Supervisor pergunta *"Quem pode cobrir a Astrid?"* — o Membro pergunta *"Que personagem faço no show das 14h?"*

**Impacto Operacional:**
A IA do Membro não precisa ter acesso ao escopo total da operação. Ela precisa ter acesso profundo ao contexto individual do Membro: sua Escala, suas Entregas, suas Solicitações, seus Livros. O objetivo é traduzir a operação complexa em orientação pessoal clara.

**Impacto para UX:**
O tom e o modo de interação da IA devem refletir o papel do usuário. Para o Supervisor: copiloto operacional, linguagem de gestão, foco em decisões. Para o Membro: assistente pessoal, linguagem direta, foco em clareza e orientação. A mesma IA — personas e escopos diferentes.

**Impacto para Interface:**
- Perguntas típicas do Membro: *"O que mudou hoje?"*, *"Tenho alguma atividade extra?"*, *"Que personagem faço no show das 14h?"*, *"Preciso chegar mais cedo?"*, *"Qual o prazo da minha entrega?"*
- A IA deve responder de forma pessoal e contextualizada, não como um relatório operacional
- Exemplo ideal: *"Hoje você tem Musical às 12h30 como Astrid. Seu horário foi antecipado em 30 minutos — chegada às 11h30."*

**Riscos:**
Expor ao Membro informações da operação inteira que não são relevantes para ele. Isso transforma a IA em fonte de ansiedade (ao revelar problemas que não são de sua responsabilidade) em vez de fonte de clareza.

**Oportunidade para IA:**
A pergunta mais valiosa que o Membro pode fazer à IA: *"Existe alguma novidade que eu preciso saber antes de ir ao trabalho hoje?"* Uma resposta bem construída pode substituir 15 minutos de verificação de grupos, mensagens e conversas.

---

### D9 — Confiança nasce da previsibilidade, não da velocidade

**Resposta Operacional:**
O Membro não precisa de resposta imediata para as suas solicitações, entregas ou dúvidas. O que gera confiança é saber que o sistema sempre se comportará da mesma forma: mudanças importantes sempre aparecerão destacadas, solicitações sempre terão estado visível, a programação de hoje sempre estará correta.

**Impacto Operacional:**
A confiança não nasce quando tudo funciona perfeitamente. Nasce quando o Membro sabe o que esperar. Um sistema que às vezes destaca mudanças e às vezes não — mesmo que tecnicamente funcional — gera desconfiança porque o Membro não consegue depender dele.

**Impacto para UX:**
Consistência é mais importante que velocidade. O produto deve se comportar de forma idêntica em todos os contextos relevantes: mudança sempre destacada, estado sempre visível, informação sempre confiável. A surpresa — mesmo positiva — quebra confiança.

**Impacto para Interface:**
- Comportamentos críticos devem ser absolutamente consistentes: alterações sempre destacadas, estados sempre visíveis, informação sempre atual
- O Membro precisa poder responder: *"Sei que se existir uma mudança, verei ela aqui"* — e confiar nisso sem precisar verificar outras fontes

**Riscos:**
Notificações inconsistentes ou estados que às vezes aparecem e às vezes não. Se o sistema falhar uma única vez em informar uma mudança importante, o Membro perderá confiança e voltará ao WhatsApp como validação paralela.

**Oportunidade para IA:**
A IA pode contribuir ativamente para a sensação de confiança: *"Verifiquei sua programação e não há alterações desde às 18h de ontem."* Confirmar que não há novidades é tão valioso quanto informar que há.

---

### D10 — O maior valor do MyASA para o Membro é converter complexidade operacional em clareza pessoal

**Resposta Operacional:**
A operação pode ser extremamente complexa — múltiplos shows, substituições, ensaios extras, livros atualizados. O Membro não precisa entender essa complexidade. Precisa entender apenas o que ela significa para ele especificamente. O produto é o tradutor entre a operação e a pessoa.

**Impacto Operacional:**
Quando o Membro tem clareza pessoal constante, os erros de execução diminuem significativamente. Não porque as pessoas são mais competentes — mas porque têm as informações corretas no momento correto. A maioria dos erros operacionais do Membro não são de capacidade. São de informação.

**Impacto para UX:**
Cada feature do produto deve ser avaliada com a pergunta: *"Isso reduz a incerteza do Membro?"* Se não reduz, não pertence ao núcleo da experiência. A complexidade da operação existe nos bastidores — a experiência do Membro deve sempre parecer simples.

**Impacto para Interface:**
Hierarquia de informação para todas as telas do Membro:
1. O que preciso fazer agora / hoje
2. O que mudou desde a última vez que acessei
3. O que está pendente de minha ação
4. Informação completa quando necessário
Nenhuma tela deve começar pelo item 4.

**Riscos:**
Expor ao Membro a complexidade que o Supervisor precisa ver. As telas do Supervisor e as telas do Membro resolvem problemas radicalmente diferentes e não devem compartilhar lógica de apresentação.

**Oportunidade para IA:**
A IA do Membro tem como função principal ser a camada de tradução entre operação e pessoa. Toda pergunta do Membro deve ser respondida em linguagem pessoal, nunca em linguagem operacional. A IA é bem-sucedida quando o Membro deixa de precisar perguntar as mesmas coisas repetidamente.

---

## Padrão Central do Membro

Todas as dez descobertas convergem para um único padrão:

> **O Membro não tem problema de capacidade. Tem problema de informação.**

A ansiedade do Membro não nasce de responsabilidades — nasce de incerteza. E a incerteza nasce de três situações recorrentes:

1. **Não saber o que mudou** — programação, personagem, horário, atividade
2. **Não saber o estado de algo que iniciou** — solicitação enviada, entrega feita, dúvida lançada
3. **Não saber onde encontrar a informação confiável** — e precisar perguntar para pessoas

O MyASA resolve os três quando garante que:
- Mudanças sempre aparecem antes que afetem a execução
- Estados sempre estão visíveis sem precisar perguntar
- Existe um lugar único onde a informação é sempre a versão correta

---

## Princípios de Design para o Membro

Derivados diretamente das descobertas:

1. **Clareza antes de completude** — mostrar o essencial primeiro, o restante sob demanda
2. **Estado sempre visível** — qualquer item em processo tem seu estado exibido proeminentemente
3. **Mudança destacada, não apenas disponível** — alterações que afetam o Membro aparecem sem precisar ser procuradas
4. **Pessoal, não operacional** — toda informação é filtrada pela perspectiva do Membro, nunca da operação inteira
5. **Consistência acima de velocidade** — o comportamento do sistema deve ser sempre o mesmo; surpresas quebram confiança
6. **IA como intérprete, não como painel** — a IA responde em linguagem pessoal, não em relatório de gestão
7. **Confirmação visível** — quando não há novidades, isso também deve ser comunicado

---

## Implicações por Pilar

| Pilar | Implicação Principal |
|---|---|
| **Meu Dia** | Começa com próximo compromisso, depois alterações, depois dia completo. Nunca começa com lista total. |
| **Escala** | O Membro vê apenas sua parte. Não a escala inteira da operação. |
| **Notificações** | Mudanças operacionais permanecem visíveis até confirmação. Não desaparecem como notificações comuns. |
| **Solicitações** | Painel de acompanhamento, não formulário. Estado sempre visível. Negativa sempre explicada. |
| **Entregas** | Ciclo completo: expectativa → envio → feedback → conclusão. Foco na clareza da expectativa antes do envio. |
| **Mensagens** | Contextuais, bidirecionais. Distintas visualmente de Avisos. |
| **Avisos** | Unidirecionais, para grupos. Confirmação de leitura quando relevante. Distintos de Mensagens. |
| **Biblioteca** | Ponto de consulta autônoma. Reduz necessidade de perguntar para pessoas sobre conhecimento operacional. |
| **IA** | Intérprete pessoal. Perguntas simples, respostas em linguagem pessoal. Conectada a todos os pilares do Membro. |
| **Histórico** | Relevante como prova e contexto. O Membro pode precisar demonstrar que não recebeu uma informação. |
