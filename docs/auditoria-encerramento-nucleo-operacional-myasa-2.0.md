# MyASA 2.0 — Auditoria de Encerramento do Núcleo Operacional

> **Versão:** 18/06/2026
> **Fase:** Auditoria de Gate — antes de avançar para Governança, IA e Conhecimento
> **Base:** Arquitetura · Pesquisas dos 3 perfis · Jornadas · Mapa de Superfícies · Arquitetura de Navegação · Bloco 1 · S-06 · Entidade MO · Ciclo de Planejamento · Ciclo de Comunicação · Wireframes Integrados
> **Status:** 🟢 Núcleo operacional encerrado

---

## Premissa da auditoria

Este documento responde uma única pergunta: **o MyASA sabe o suficiente sobre seu núcleo operacional para avançar com segurança para o design visual e para o modelamento dos blocos restantes?**

A resposta é sim — com um conjunto de ressalvas mapeadas e priorizadas abaixo.

---

## PARTE 1 — COBERTURA

---

### 1.1 Existe alguma decisão operacional importante ainda não modelada?

**Resposta: sim. Três decisões ainda abertas.**

---

**Lacuna Aberta L-01 — Ciclo de vida das Entregas (S-07) dentro do núcleo operacional**

As Entregas são mencionadas na arquitetura (4 tipos: Tarefa simples, Projeto, Entrega digital, Avaliação presencial) e aparecem como dado no Meu Dia (S-01), mas o ciclo de vida delas — criação, progresso, entrega, avaliação — nunca foi modelado. Nenhuma das entidades operacionais modeladas até aqui (Mudança Operacional, Ciclo de Planejamento, Ciclo de Comunicação) toca Entregas.

**Impacto no núcleo:** baixo. Entregas não alimentam Escala, Livro do Dia, Avisos ou Histórico operacional. São paralelas ao ciclo de escala.

**Impacto no MVP:** médio. O Membro vê prazo de entrega no Meu Dia. Sem ciclo de vida definido, não há como modelar esse dado.

**Bloco seguinte que precisa modelar:** S-07, antes de wireframes de S-01 (Meu Dia).

---

**Lacuna Aberta L-02 — Comportamento da Agenda (S-12) como fonte de eventos da Escala**

A arquitetura define: "Agenda é a fonte oficial dos eventos. Eventos com impacto operacional aparecem na Escala." Mas o mecanismo exato de como um evento da Agenda vira uma demanda de cobertura na Escala não foi modelado. Quem cria o evento? O que acontece automaticamente? Quando o Supervisor precisa agir?

**Impacto no núcleo:** médio. O Ciclo de Planejamento Operacional assume que os eventos já existem na Escala — não modela como chegaram lá. A lacuna está a montante do ciclo modelado.

**Bloco seguinte que precisa modelar:** S-12, antes de wireframes de S-04 (Escala).

---

**Lacuna Aberta L-03 — Modelo de permissões de escrita da IA (S-10)**

A arquitetura define: "A IA atua dentro das permissões do usuário que a acionou." O Ciclo de Comunicação Operacional define que a IA nunca executa — propõe → usuário confirma → executa. Mas o modelo completo de o que a IA pode propor por perfil, em qual superfície, com qual reversibilidade, não foi modelado formalmente.

**Impacto no núcleo:** baixo para o ciclo atual. As superfícies S-05, S-08 e S-11 usam a IA como leitura (narrativa, análise, resposta). Nenhuma delas exige que a IA escreva na operação.

**Impacto em S-10 dedicada:** alto. Sem esse modelo, o design da IA como superfície (chat livre) e como fluxo de confirmação não pode ser iniciado.

**Bloco seguinte que precisa modelar:** S-10, bloco próprio antes de wireframes de S-10.

---

### 1.2 Existe alguma entidade sem dono?

**Resposta: uma entidade com dono parcial.**

---

**Entidade sem dono completo: Livro do Show (S-13)**

O Livro do Show é a entidade mais crítica do sistema que ainda não tem ciclo de vida modelado. Ele:

- É criado por Admin ou Supervisor (definido na arquitetura)
- Gera o Livro do Dia (mecanismo modelado no Ciclo de Planejamento)
- Precisa de tags de exigência operacional por papel (decisão D-18)
- Nunca propaga automaticamente mudanças para Livros do Dia já gerados (decisão arquitetural)

Mas: **ninguém modelou quem edita o Livro do Show, quando, com que consequências, e como o sistema controla versões do template.**

**Por que isso importa agora:** a D-18 — papéis no Livro do Show precisam de tags de exigência operacional — foi produzida pela auditoria de wireframe. Se o Livro do Show não tiver esse campo, o motor de restrições tem ponto cego. Mas "quem garante que esse campo existe" nunca foi respondido.

**Dono sugerido:** Admin cria e mantém o Livro do Show. Supervisor pode solicitar ajustes. Admin aprova. Isso precisa ser modelado em S-13 antes do desenvolvimento de S-05.

---

**Entidades com dono completo (confirmação):**

| Entidade | Dono | Definido em |
|---|---|---|
| Mudança Operacional | Sistema (gerado automaticamente) | Entidade MO |
| Solicitação | Membro (cria) · Supervisor/Admin (decide) | Ciclo de Planejamento · S-06 |
| Folga | Subtipo de Solicitação | Ciclo de Planejamento |
| Restrição | Supervisor/Admin registra (nunca o Membro diretamente) | Arquitetura · Ciclo de Planejamento |
| Livro do Dia | Supervisor (publica) · Sistema (proposta) | Ciclo de Comunicação · Wireframes |
| Aviso | Sistema (automático) · Supervisor (manual adicional) | Ciclo de Comunicação · Wireframes |
| Histórico | Sistema (registra automaticamente) | Ciclo de Comunicação · Wireframes |
| Escala | Supervisor/Admin (publicam) | Bloco 1 |
| Grupo Operacional | Admin (cria/configura) | Arquitetura |

---

### 1.3 Existe alguma dependência oculta?

**Resposta: duas dependências identificadas.**

---

**Dependência Oculta DO-01 — Livro do Show → Motor de Restrições**

O motor de candidatos do Livro do Dia (que elimina membros incompatíveis automaticamente) depende de:
1. Restrições do membro (modeladas)
2. Tags de exigência dos papéis no Livro do Show (**não modeladas**)

Se o Livro do Show não tiver tags de exigência completas, o motor de restrições funciona parcialmente — detecta conflitos quando o papel tem tag, deixa passar quando não tem. Isso foi identificado como ponto cego na auditoria de wireframes (D-18).

**Consequência para design:** os wireframes e mockups de S-05 podem ser desenvolvidos normalmente. Mas o desenvolvimento do motor de candidatos em S-05 está bloqueado até que S-13 defina as tags.

---

**Dependência Oculta DO-02 — Agenda → Escala → Livro do Dia**

A cadeia Agenda → Escala → Livro do Dia tem um elo não modelado: **como um evento da Agenda se transforma em uma demanda de cobertura na Escala**. O Ciclo de Planejamento Operacional começa com a Solicitação já sendo analisada — não modela o momento anterior em que o Supervisor descobre que tem um show e precisa escalar.

**Consequência para design:** S-04 (Escala) precisa modelar o fluxo de recebimento de eventos da Agenda antes do wireframe. Especificamente: o que o Supervisor vê quando um novo show é adicionado à Agenda e ainda não tem cobertura na Escala.

---

### 1.4 Existe alguma superfície crítica sem fundamento suficiente?

**Resposta: uma superfície primária com fundamento incompleto.**

---

**S-03 — Painel de Saúde (Home do Admin)**

O Painel de Saúde está definido como superfície (no Mapa de Superfícies) com:
- Objetivo claro: "O ecossistema está saudável?"
- Informações prioritárias definidas (5 itens)
- Jornadas relacionadas (JA-01, JA-04, JA-02)
- Relação com IA definida

Mas não tem:
- Modelo comportamental de como os indicadores são calculados
- Definição de quando uma Operação muda de Saudável para Atenção para Crítico
- Modelo de como o Admin age a partir do Painel (quais ações estão disponíveis inline vs. navegação para outra superfície)
- Ciclo de vida dos itens do Painel (quando somem, quando persistem, quando se resolvem automaticamente)

**Grau de risco:** médio. O Admin usa o Painel para investigar → Histórico, e para configurar → Operações/Grupos. O Painel é diagnóstico, não execução. Mas sem o modelo de indicadores, o wireframe do Painel será superficial.

**Recomendação:** modelar o ciclo comportamental de S-03 antes dos wireframes do Painel de Saúde.

---

## PARTE 2 — FRONTEIRAS

---

### Escala ↔ Livro do Dia

**Fronteira:** a Escala define *quem está disponível e alocado em qual data*. O Livro do Dia define *como um show específico está estruturado internamente*. A Escala alimenta o Livro — não o contrário.

**Sobreposição:** ambas mostram "quem está alocado em qual atividade". Essa sobreposição é aparente — a perspectiva é diferente (calendário vs. espetáculo).

**Lacuna identificada:** a janela entre APLICADA (Escala atualizada) e PUBLICADA (Livro republicado) cria divergência temporária. Esse gap foi modelado e documentado — a mitigação é o estado DESATUALIZADO visível no Livro.

**Regra de fronteira validada:**
> A Escala é o calendário de alocação. O Livro do Dia é o documento de show. A Escala precede o Livro — a geração do Livro parte da Escala, nunca o contrário.

**Status:** ✅ Fronteira definida e sem lacuna estrutural.

---

### Livro do Dia ↔ Avisos

**Fronteira:** o Livro do Dia contém o estado atual. O Aviso comunica o delta. O Aviso nunca replica o estado completo do Livro — mostra apenas o que mudou para aquele destinatário.

**Sobreposição:** o delta do Livro (ERA → AGORA) aparece tanto no Aviso quanto no Livro Republicado. A sobreposição é intencional — são frames de referência diferentes (perspectiva do membro vs. perspectiva do documento).

**Lacuna:** nenhuma.

**Regra de fronteira validada:**
> Publicação do Livro dispara Avisos automaticamente (D-12). Não existe Aviso de mudança antes da publicação. Não existe publicação sem Aviso para os afetados.

**Status:** ✅ Fronteira definida e mecanismo automático documentado.

---

### Avisos ↔ Meu Dia

**Fronteira:** o Aviso é o ato de comunicação (permanente, imutável, rastreável). O Meu Dia é a representação contextual da realidade operacional do dia (dinâmica, pessoal, atualizada). O card de alteração no Meu Dia é alimentado pelo mesmo evento que gera o Aviso — mas são objetos distintos com comportamentos distintos.

**Sobreposição:** ambos exibem "sua programação mudou". A sobreposição é de conteúdo, não de propósito. O card no Meu Dia desaparece do topo após confirmação. O Aviso permanece no histórico para sempre.

**Lacuna:** a confirmação no Meu Dia deve sincronizar com o status do Aviso em S-08. Esse mecanismo foi documentado (UX-02: confirmação não exige S-08) mas o detalhe técnico de como o estado "confirmado" propaga entre superfícies não foi modelado. Isso é dependência de desenvolvimento, não de design.

**Regra de fronteira validada:**
> O Meu Dia mostra o estado do dia (efêmero). O Aviso registra o evento de comunicação (permanente). A confirmação em qualquer superfície é válida para todas — não pode haver dupla confirmação do mesmo evento.

**Status:** ✅ Fronteira definida. Sincronização de estado é dependência técnica, não lacuna de modelo.

---

### Meu Dia ↔ Histórico

**Fronteira:** o Meu Dia mostra o presente pessoal do Membro ("o que é verdade agora para mim hoje"). O Histórico mostra o passado operacional ("o que aconteceu e por quê"). O Membro consulta o Histórico quando quer entender *como* chegou ao estado atual do Meu Dia.

**Sobreposição:** nenhuma — perspectivas temporais completamente diferentes.

**Lacuna:** o Membro acessa seu histórico pessoal em S-11, mas a navegação de S-01 → S-11 não foi explicitamente definida no mapa de navegação. Estava implícita nas jornadas (JI-05), mas não como regra de travessia formal.

**Resolução:** adicionar T-07 (Meu Dia → Histórico Pessoal) ao mapa de travessias. Gatilho: "Ver histórico das minhas mudanças". Contexto preservado: filtro automático por membro ativo.

**Regra de fronteira validada:**
> O Meu Dia não acessa dados de outros membros — nunca. O Histórico do Membro é filtrado exclusivamente para sua realidade. Isso é inegociável (conforme pesquisa de perfis: o Membro precisa sentir que o sistema fala só com ele).

**Status:** ✅ Fronteira definida. Travessia T-07 deve ser adicionada aos wireframes.

---

### Solicitações ↔ Mudanças Operacionais

**Fronteira:** a Solicitação é um pedido feito pelo Membro (ou registrado pelo Supervisor). A Mudança Operacional é uma entidade do sistema criada automaticamente quando a Solicitação é decidida e afeta a operação. A Solicitação é a origem — a Mudança Operacional é a consequência.

**Sobreposição:** a Solicitação aprovada e a Mudança Operacional gerada representam o mesmo evento visto de perspectivas diferentes. A Solicitação é o registro do pedido (quem pediu, o que pediu, quando, por quê). A MO é o registro do impacto (o que mudou, quem foi afetado, o que foi comunicado).

**Lacuna identificada:** existe uma classe de Mudanças Operacionais que não nasce de Solicitação — nasce de ação direta do Supervisor ou Admin (ex.: Supervisor republicação direta do Livro do Dia, Admin reconfiguração de estrutura). Para essas MOs, a "origem" no Histórico precisa de um frame diferente — não é Solicitação, é Ação Direta. Esse frame existe conceitualmente mas não foi modelado formalmente como tipo de origem.

**Resolução:** o Histórico deve suportar dois tipos de origem para uma MO: (1) Solicitação decidida — com vínculo ao registro da Solicitação; (2) Ação Direta — com o autor, timestamp e motivo declarado (D-20).

**Regra de fronteira validada:**
> Toda Solicitação aprovada que afeta a operação gera MO. Nem toda MO nasce de Solicitação. A entidade MO é mais ampla que a Solicitação — é o registro de qualquer evento que altera o estado operacional, independente da origem.

**Status:** ✅ Fronteira definida. Tipos de origem de MO adicionados formalmente.

---

## PARTE 3 — BLOCOS RESTANTES

---

### S-03 — Painel de Saúde (Home do Admin)

**Quanto já está definido:**
- Objetivo: completo (mapa de superfícies)
- Audiência: completo
- Informações prioritárias: 5 itens definidos
- Jornadas relacionadas: 3 jornadas mapeadas
- Relação com IA: definida
- Riscos de design: 4 identificados

**O que ainda falta:**
- Modelo comportamental dos indicadores de saúde (o que mede "saudável vs. atenção vs. crítico")
- Ciclo de vida dos alertas no Painel (quando somem, quando persistem)
- Fluxo de ação inline vs. navegação (o Admin age no Painel ou vai para outra superfície?)
- Modelo de múltiplas Operações (como o Admin gerencia saúde de N Operações simultaneamente)
- Wireframes estruturais

**O que depende dos ciclos já concluídos:**
- Os indicadores de saúde são construídos sobre dados do Ciclo de Comunicação Operacional: frequência de Mudanças Operacionais, taxa de confirmação, posições Em Aberto, padrões detectados pela IA
- O Painel de Saúde é, em grande parte, uma agregação do Histórico de S-11 — que agora está modelado

**O que pode ser iniciado imediatamente:**
- Modelagem comportamental dos indicadores (o que entra no cálculo de "saúde")
- A estrutura de investigação do Admin (que usa S-11 como base, já modelado)
- Wireframes do Painel de Saúde

---

### S-07 — Entregas

**Quanto já está definido:**
- Arquitetura: 4 tipos (Tarefa simples, Projeto, Entrega digital, Avaliação presencial)
- Permissões de criação: definidas (Admin → todos; Supervisor → seu escopo; Membro → si mesmo)
- Relação com Meu Dia: mencionada (prazo de entrega aparece no Meu Dia)
- Estratégia de MVP: Tarefa simples e Entrega digital no MVP; Projeto e Avaliação presencial em V2

**O que ainda falta:**
- Ciclo de vida completo de uma Entrega (criada → em progresso → entregue → avaliada → encerrada)
- Estados formais por tipo de Entrega
- Comportamento de Mensagens contextuais dentro de uma Entrega
- Modelo de como Entrega aparece no Meu Dia do Membro (com que nível de detalhe, quando some, quando persiste)
- Relação de Entrega com o Histórico (toda Entrega gera registro? somente as decisões?)
- Wireframes estruturais

**O que depende dos ciclos já concluídos:**
- Entregas se registram no Histórico de S-11 — o modelo de Histórico já existe
- O Aviso de entrega (ex.: prazo próximo) usa a infraestrutura de Avisos de S-08 — já modelada
- A aparição no Meu Dia de S-01 — arquitetura do Meu Dia já definida

**O que pode ser iniciado imediatamente:**
- Modelagem comportamental do ciclo de vida de Entrega (começando por Tarefa simples)
- Wireframes de S-07 para os tipos MVP

---

### S-10 — IA / Assistente

**Quanto já está definido:**
- Três personas: Copiloto Operacional (Supervisor) · Intérprete Pessoal (Membro) · Analista Organizacional (Admin)
- Modo embarcado vs. modo dedicado (chat livre): definido
- Fluxo obrigatório: Proposta → Confirmação → Execução → Desfazer (D-01 a D-10 cobrem isso)
- As 6 perguntas obrigatórias que a IA responde (definidas na Entidade MO)
- Relação com cada superfície: definida no mapa de superfícies
- Riscos de design: 5 identificados
- Registro no Histórico de todas as ações da IA: mandatório

**O que ainda falta:**
- Modelo completo de permissões da IA por perfil: o que cada persona pode propor (escrita), consultar (leitura) e nunca fazer
- Fluxo de confirmação de ação da IA na interface: como o usuário aprova uma proposta da IA (especialmente no contexto de escala/publicação)
- Comportamento da IA quando não tem dados suficientes para responder
- Comportamento da IA em múltiplas Operações simultâneas (contexto do Admin)
- Modelo de degradação graceful: o que acontece quando a IA não consegue processar
- Wireframes do chat dedicado + elementos embarcados por superfície

**O que depende dos ciclos já concluídos:**
- A IA narrativa do Histórico (S-11) está modelada — a IA transforma registros em narrativa de investigação
- Os 7 modos de atuação da IA no ciclo de comunicação estão modelados (Analítico, Narrativo, Vigilante em cada superfície)
- As superfícies onde a IA é embarcada (S-05, S-08, S-11) têm o modelo comportamental completo

**O que pode ser iniciado imediatamente:**
- Modelagem de permissões da IA por perfil (o que cada persona pode propor vs. apenas ler)
- Wireframe do chat dedicado (S-10 como superfície)
- Design dos elementos embarcados contextualmente dentro dos mockups de S-05, S-08 e S-11

---

### S-12 — Agenda

**Quanto já está definido:**
- Objetivo: completo (fonte oficial de eventos)
- Audiência por perfil: completo
- Tipos de eventos (com/sem impacto operacional): completo
- Tensão de design Agenda/Escala: documentada
- Jornadas: 2 mapeadas (JS-06, JA-05)
- Compromissos pessoais do Membro: comportamento definido (privados, sem impacto operacional)

**O que ainda falta:**
- Modelo de como um evento da Agenda gera demanda de cobertura na Escala (Lacuna DO-02)
- Comportamento quando um evento é cancelado, adiado ou alterado (impacto cascata na Escala)
- Modelo de permissões de edição (Admin cria shows; Supervisor pode criar ensaios dentro do escopo?)
- Integração com Livro do Show (cada evento da Agenda tem um Livro do Show associado — como essa associação é feita?)
- Wireframes estruturais

**O que depende dos ciclos já concluídos:**
- Cancelamento de evento da Agenda gera Mudança de Show (tipo 6 da Entidade MO) — já modelado
- Alteração de horário de evento gera Mudança de Horário (tipo 3) — já modelado

**O que pode ser iniciado imediatamente:**
- Modelagem do fluxo evento novo na Agenda → demanda de cobertura na Escala
- Wireframes estruturais de S-12

---

### S-13 — Livro do Show

**Quanto já está definido:**
- Definição: template permanente de cada espetáculo (papéis, posições, regras de substituição, elenco base)
- Dois modelos internos: Simples (Papel → Pessoa) e Estruturado (Cena → Bloco → Posição → Pessoa)
- Regra crítica: mudança no Livro do Show NÃO propaga automaticamente para Livros do Dia existentes
- Audiência: Admin (cria), Supervisor (consulta)
- Frequência: baixa (criado uma vez, atualizado raramente)
- Tensão com S-05: documentada no mapa de superfícies

**O que ainda falta:**
- Ciclo de vida do Livro do Show (criação, edição, versionamento, descontinuação)
- Modelo de tags de exigência operacional por papel (D-18) — campo obrigatório, quem preenche, como é validado
- Fluxo de propagação controlada: quando o Livro do Show muda, como o sistema sinaliza quais Livros do Dia futuros devem ser revisados?
- Modelo de aprovação de mudança estrutural (quem aprova alteração no Livro do Show?)
- Diferenciação visual entre Livro do Show e Livro do Dia (risco documentado: usuário edita um achando que é o outro)
- Wireframes estruturais

**O que depende dos ciclos já concluídos:**
- O Livro do Show alimenta o motor de geração do Livro do Dia — completamente dependente do Ciclo de Planejamento já modelado
- As tags de exigência operacional (D-18) são pré-requisito para o motor de restrições do Ciclo de Planejamento funcionar corretamente

**O que pode ser iniciado imediatamente:**
- Modelagem comportamental de S-13 (especialmente ciclo de vida e modelo de tags)
- Esta é a **próxima prioridade crítica** após os mockups de S-05, S-08 e S-11

---

### S-14 — Biblioteca

**Quanto já está definido:**
- Objetivo: repositório de conhecimento da Operação
- Conteúdos: Manual do Elenco, Diretrizes, Procedimentos, Regulamentos, Treinamentos
- Relação com IA: a IA acessa a Biblioteca automaticamente para responder perguntas
- Estratégia de acesso: Membro acessa primariamente via IA (não diretamente)
- Riscos: 3 identificados

**O que ainda falta:**
- Modelo de publicação e atualização de conteúdo (quem publica, quem aprova, como versionar)
- Modelo de indexação para a IA (como a IA "sabe" o que está na Biblioteca)
- Ciclo de vida de um documento (ativo → desatualizado → arquivado)
- Modelo de acesso direto vs. acesso mediado pela IA
- Wireframes estruturais

**O que depende dos ciclos já concluídos:**
- A Biblioteca é fonte de contexto para a IA — depende do modelo de permissões de leitura da IA (S-10) ainda não modelado
- Nenhuma dependência direta do Ciclo de Comunicação Operacional

**O que pode ser iniciado imediatamente:**
- Modelagem da estrutura de conteúdo e ciclo de publicação (independe da IA)
- Wireframes para a visão Admin (gestão de conteúdo)

---

### S-15 — Equipes / Grupos Operacionais

**Quanto já está definido:**
- Objetivo: estrutura humana da Operação (Grupos, Membros, Supervisores, Funções)
- Audiência: Admin (gestão), Supervisor (consulta)
- Informações prioritárias: 5 itens definidos
- Jornadas: 2 mapeadas (JA-03, JA-06)
- Decisões que suporta: 3 definidas
- Riscos: 3 identificados
- Pilar embutido: Restrições ativas visíveis no Perfil do Membro

**O que ainda falta:**
- Ciclo de vida do Perfil do Membro (criação, onboarding, mudança de função, saída)
- Modelo de transferência de responsabilidades quando um membro sai (suas Entregas e Solicitações em andamento)
- Ciclo de vida de Restrições dentro do perfil (como aparece, como é revisada, como expira)
- Modelo de múltiplos Grupos por membro (membro pode estar em mais de um Grupo — como isso aparece para o Supervisor?)
- Wireframes estruturais

**O que depende dos ciclos já concluídos:**
- Mudança de Estrutura (tipo 5 da Entidade MO) afeta diretamente S-15 — modelado
- Restrições modeladas no Ciclo de Planejamento são registradas no perfil do membro em S-15

**O que pode ser iniciado imediatamente:**
- Modelagem do Perfil do Membro e ciclo de vida
- Wireframes de S-15 (estrutura de grupos + perfil do membro)

---

### S-16 — Operações

**Quanto já está definido:**
- Objetivo: gestão das Operações no sistema (criar, configurar, ativar, desativar)
- Audiência: Admin
- Frequência: muito baixa (criação única)
- Tensão com S-15: documentada (Operação → Grupos → Membros)

**O que ainda falta:**
- Configurações por Operação (quais parâmetros cada Operação pode ter)
- Modelo de multi-Operação para o Admin (como navega entre Operações)
- Ciclo de criação de nova Operação (onboarding wizard ou formulário simples?)
- Ciclo de desativação de Operação (o que acontece com os dados?)
- Wireframes estruturais

**O que depende dos ciclos já concluídos:**
- Toda a Escala, Livro do Dia e Ciclo de Comunicação existem dentro de uma Operação — a fronteira está modelada

**O que pode ser iniciado imediatamente:**
- Wireframes básicos de S-16 (criação e gestão de Operação)

---

### S-17 — Configurações

**Quanto já está definido:**
- Objetivo: parâmetros técnicos e operacionais (usuários, permissões, notificações, regras de validação, integrações)
- Audiência: Admin
- Frequência: baixíssima
- Riscos: 2 identificados

**O que ainda falta:**
- Inventário completo de configurações (o que é configurável vs. fixo no sistema)
- Modelo de permissões de acesso por perfil (quem pode ver o quê dentro de Configurações)
- Impacto das configurações de validação da Escala no Ciclo de Planejamento (ex.: limiar de cobertura mínima — esse parâmetro é configurável por Operação?)
- Wireframes estruturais

**O que depende dos ciclos já concluídos:**
- As regras de validação da Escala (limiares de cobertura, alertas de posição Em Risco) foram definidas comportamentalmente no Ciclo de Planejamento — S-17 é onde esses parâmetros são configurados
- Os limiares de escalada de Aviso (T-2h, T-30min, T-15min) definidos no Ciclo de Comunicação — S-17 pode tornar esses configuráveis

**O que pode ser iniciado imediatamente:**
- Inventário de configurações mapeando quais parâmetros comportamentais dos Ciclos são configuráveis
- Wireframes básicos de S-17

---

## PARTE 4 — RISCO DE RETRABALHO

---

### Se iniciarmos mockups de S-05 (Livro do Dia)

**Risco:** 🟢 Baixo

**Fundamento:** comportamento modelado em 3 documentos (Ciclo de Planejamento, Ciclo de Comunicação, Wireframes). 4 estados definidos (WL-01 a WL-04). Hierarquia de conteúdo por perfil definida. 10 decisões de wireframe (WF-01 a WF-10). Todas as 20 decisões D + UX verificadas e aplicadas.

**Risco residual:** a D-18 (tags de exigência operacional no Livro do Show) afeta o motor de candidatos — mas não afeta o design visual do Livro do Dia. O mockup de S-05 pode ser desenvolvido completamente sem que S-13 esteja modelado.

**Conclusão:** 🟢 Mockup de S-05 pode ser iniciado imediatamente.

---

### Se iniciarmos mockups de S-08 (Avisos)

**Risco:** 🟢 Baixo

**Fundamento:** comportamento modelado no Ciclo de Comunicação. 4 estados definidos (WA-01 a WA-04). Dois perfis de experiência completamente distintos (Membro = recebimento; Supervisor = rastreamento). 6 estados do ciclo de vida do Aviso. Regras de nível automático.

**Risco residual:** nenhum estrutural. O comportamento de Aviso de Entrega (S-07) pode adicionar um tipo de Aviso que ainda não existe — mas não altera os wireframes atuais.

**Conclusão:** 🟢 Mockup de S-08 pode ser iniciado imediatamente.

---

### Se iniciarmos mockups de S-11 (Histórico)

**Risco:** 🟢 Baixo

**Fundamento:** comportamento modelado no Ciclo de Comunicação e no UX Integrado. 5 modos de investigação definidos (WH-01 a WH-05). Protocolo de investigação em 5 passos. Hierarquia de conteúdo por perfil definida.

**Risco residual:** quando S-07 (Entregas) for modelado, o Histórico vai ganhar um novo tipo de evento (Entrega encerrada, Entrega avaliada). Isso não altera a estrutura do Histórico — apenas adiciona um novo agrupamento. Sem risco de retrabalho estrutural.

**Conclusão:** 🟢 Mockup de S-11 pode ser iniciado imediatamente.

---

### Único cenário de risco médio identificado

Se a modelagem de S-13 (Livro do Show) revelar que a estrutura de papéis é radicalmente diferente do que foi assumido em S-05 (ex.: papéis têm hierarquia de 4 níveis em vez de 2), pode ser necessário rever a hierarquia de conteúdo do Livro do Dia. Esse risco é **médio** e **hipotético** — a arquitetura já define dois modelos (Simples e Estruturado) e os wireframes de S-05 usam o modelo Estruturado como referência. A probabilidade de retrabalho é baixa, mas existe.

**Mitigação:** modelar S-13 em paralelo aos mockups de S-05, não depois. Se houver divergência estrutural, ela será detectada antes do fim dos mockups.

---

## PARTE 5 — VEREDITO

---

### O núcleo operacional do MyASA está encerrado?

**Sim.**

O núcleo operacional — o conjunto de conceitos, entidades, comportamentos, fluxos e estruturas que definem como o MyASA funciona para seus três perfis nos seus ciclos de trabalho mais frequentes — está completamente definido e sem contradições.

---

### Blocos oficialmente concluídos

Os seguintes blocos passam a ser considerados **concluídos** para fins de progressão para mockup visual e desenvolvimento:

---

**🟢 BLOCO CONCLUÍDO: Entidade Mudança Operacional**
Definição oficial completa. 9 tipos. 9 estados. Propagação por todas as superfícies. Confirmação, auditoria e IA modelados. Lacunas identificadas e resolvidas. *Documento: `docs/mudanca-operacional-myasa-2.0.md`*

---

**🟢 BLOCO CONCLUÍDO: Ciclo de Planejamento Operacional**
5 tipos de Solicitação modelados end-to-end. 10 decisões estratégicas (D-01 a D-10). Fluxo completo desde a Solicitação até a Mudança Operacional. *Documento: `docs/ciclo-planejamento-operacional-myasa-2.0.md`*

---

**🟢 BLOCO CONCLUÍDO: Ciclo de Comunicação Operacional**
S-05, S-08 e S-11 modelados como perspectivas integradas da Mudança Operacional. 10 novas decisões (D-11 a D-20). Propagação por 9 tipos de MO. 7 casos limite. Auditoria de consistência. *Documento: `docs/ciclo-comunicacao-operacional-myasa-2.0.md`*

---

**🟢 BLOCO CONCLUÍDO: UX Integrado do Ciclo de Comunicação**
Jornadas integradas (JI-01 a JI-05). Arquitetura de informação por superfície. Hierarquia de conteúdo por perfil. Regras de navegação. 10 decisões de UX (UX-01 a UX-10). *Documento: `docs/ux-integrado-ciclo-comunicacao-myasa-2.0.md`*

---

**🟢 BLOCO CONCLUÍDO: Wireframes Estruturais do Ciclo de Comunicação**
13 wireframes em ASCII. 6 travessias mapeadas. 7 cenários cobertos. 10 decisões de wireframe (WF-01 a WF-10). Conformidade verificada com todas as 20 decisões D e 10 decisões UX. *Documento: `docs/wireframes-ciclo-comunicacao-myasa-2.0.md`*

---

**🟢 BLOCO CONCLUÍDO: S-06 Solicitações**
Mockup visual completo com 11 componentes (W1–W11). Especificação comportamental completa. *Documentos: `docs/especificacao-s06-solicitacoes.md` + canvas*

---

### O que não está concluído e a sequência recomendada

| Prioridade | Bloco | Por que esta posição | Pode ser iniciado? |
|---|---|---|---|
| 1 | **Mockups visuais de S-05, S-08, S-11** | Fundação completa. Pronto para visual. | ✅ Imediatamente |
| 2 | **S-13 Livro do Show — modelagem** | Dependência crítica do motor de S-05. Em paralelo com mockups. | ✅ Imediatamente |
| 3 | **S-10 IA — modelo de permissões** | Desbloqueia design de IA embarcada nos mockups de S-05/S-08/S-11 | ✅ Em paralelo |
| 4 | **S-03 Painel de Saúde — ciclo comportamental** | Fundação parcial. Precisa de modelo antes de wireframe. | ✅ Após mockups iniciados |
| 5 | **S-12 Agenda — fluxo evento → Escala** | Dependência DO-02. Desbloqueia wireframes de S-04. | ✅ Após S-03 |
| 6 | **S-07 Entregas — ciclo de vida** | Desbloqueia Meu Dia completo e dados de Histórico | ✅ Após S-12 |
| 7 | **S-15 Equipes / Grupos — Perfil do Membro** | Desbloqueia estrutura de dados humanos e restrições | ✅ Após S-07 |
| 8 | **S-14, S-16, S-17** | Menor urgência. Nenhum bloqueia mockups ou modelagem do núcleo. | Em V2 ou setup |

---

### Inventário completo de decisões formalizadas

| Série | Decisões | Fonte |
|---|---|---|
| D-01 a D-10 | Planejamento Operacional | Ciclo de Planejamento |
| D-11 a D-20 | Comunicação Operacional | Ciclo de Comunicação |
| UX-01 a UX-10 | Design Integrado | UX Integrado |
| WF-01 a WF-10 | Wireframe Estrutural | Wireframes Integrados |
| **Total: 40 decisões formalizadas** | | |

Adicionalmente, esta auditoria produz:

| # | Decisão de Auditoria |
|---|---|
| AU-01 | O Histórico suporta dois tipos de origem de MO: Solicitação decidida (com vínculo) e Ação Direta (com autor + motivo declarado, D-20) |
| AU-02 | Travessia T-07 (Meu Dia → Histórico Pessoal do Membro) deve ser adicionada ao mapa de travessias dos wireframes |
| AU-03 | S-13 (Livro do Show) deve ser modelado em paralelo aos mockups de S-05 — não após — para mitigar risco médio de divergência estrutural |
| AU-04 | Os parâmetros comportamentais dos Ciclos (limiares de escalada, cobertura mínima) são candidatos a configuração por Operação em S-17 — isso deve ser explicitado na modelagem de S-17 |

---

## 🟢 Núcleo operacional encerrado

O MyASA 2.0 tem base conceitual suficiente para iniciar mockups visuais de S-05, S-08 e S-11, e para avançar em paralelo para a modelagem de S-13 e S-10.

Não existe risco estrutural que justifique atrasar o início dos mockups. Os 40 decisions formalizadas garantem que o trabalho visual seja guiado — não seja uma descoberta.

---

*Documento elaborado por Product Designer Sênior — MyASA 2.0*
*Auditoria realizada em 18/06/2026*
*Base: todos os documentos do núcleo operacional produzidos em 18/06/2026*
