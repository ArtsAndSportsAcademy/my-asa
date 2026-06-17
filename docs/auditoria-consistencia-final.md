# MyASA 2.0 — Auditoria de Consistência Final

> Data: 17/06/2026
> Fase: Pré-Interface — validação da fundação completa
> Escopo: Arquitetura + Diretrizes + 3 Pesquisas + Jornadas + Mapa de Superfícies
> Auditor: Product Architect + UX Auditor

---

## Metodologia

Cruzamento sistemático entre os 7 documentos base. Cada achado é classificado como:

- 🟢 **Consistente** — alinhamento total entre documentos
- 🟡 **Atenção** — divergência menor, resolvível sem redesenho
- 🔴 **Inconsistente** — conflito real que exige resolução antes de avançar

---

## QUESTÃO 1 — Existe alguma superfície sem jornada?

**Método:** Para cada uma das 17 superfícies, verificar se existe pelo menos uma jornada mapeada que a usa como superfície primária ou de apoio.

| Superfície | Jornadas relacionadas | Status |
|---|---|---|
| S-01 Meu Dia | JM-01, JM-02, JM-05 | 🟢 |
| S-02 Painel Operacional | JS-01, JS-03, JS-08, JS-05 | 🟢 |
| S-03 Painel de Saúde | JA-01, JA-02, JA-04 | 🟢 |
| S-04 Escala | JS-04, JS-02, JS-03, JS-08 | 🟢 |
| S-05 Livro do Dia | JS-04, JS-03, JM-01 (aprofundamento) | 🟢 |
| S-06 Solicitações | JM-03, JS-02, JA-01 (indicador) | 🟢 |
| S-07 Entregas | JM-04, JS-07 | 🟢 |
| S-08 Avisos | JS-05, JM-01 (elemento) | 🟢 |
| S-09 Mensagens | JM-02, JM-03, JM-04, JS-05 | 🟢 |
| S-10 IA | JM-05 + embarcada em todas | 🟢 |
| S-11 Histórico | JA-02 (principal), JA-06 | 🟢 |
| S-12 Agenda | JS-06 (referência de data), JA-05 | 🟡 |
| S-13 Livro do Show | JA-05 (setup), JS-04 (dependência implícita) | 🟡 |
| S-14 Biblioteca | JM-05 (apenas via IA — acesso direto não mapeado) | 🟡 |
| S-15 Equipes / Grupos | JA-03, JA-06 | 🟢 |
| S-16 Operações | JA-05, JA-03 | 🟢 |
| S-17 Configurações | JA-05 (parcialmente) | 🟡 |

**Achados:**

🟡 **S-12 (Agenda):** Aparece como referência de data em JS-06 (Planejamento Semanal) e como alvo de configuração em JA-05 (Setup), mas nenhuma jornada descreve como o Supervisor usa a Agenda ativamente no dia a dia. Jornada de consulta rotineira não existe.

🟡 **S-13 (Livro do Show):** Referenciado em JA-05 (setup inicial) e como dependência implícita de JS-04 (Geração do Livro do Dia), mas nenhuma jornada descreve a edição ou manutenção do Livro do Show após o setup inicial.

🟡 **S-14 (Biblioteca):** A jornada JM-05 (Consulta à IA) representa o acesso do Membro à Biblioteca de forma mediada pela IA. O acesso direto — um Membro ou Supervisor navegando pela Biblioteca sem passar pela IA — não tem jornada mapeada. Isso é coerente com a decisão estratégica (a IA como mediadora preferencial), mas precisa ser declarado explicitamente.

🟡 **S-17 (Configurações):** Presente apenas como parte de JA-05 (Setup de Nova Operação). Nenhuma jornada de manutenção (atualização de permissões, ajuste de notificações) foi mapeada.

**Conclusão Q1:** Nenhuma inconsistência estrutural. As 4 superfícies em atenção têm jornadas implícitas ou deliberadamente ausentes — mas as razões são válidas. Nenhuma dessas lacunas bloqueia o design de interface, pois todas são superfícies Eventuais ou Administrativas.

---

## QUESTÃO 2 — Existe alguma jornada sem superfície?

**Método:** Para cada uma das 20 jornadas, verificar se existe superfície que a suporta — e se essa superfície menciona a jornada em seu campo "jornadas relacionadas".

**Parte A — Jornadas com superfície mas não referenciadas no mapa de superfícies:**

| Jornada | Superfície que a suporta | Referenciada na superfície? |
|---|---|---|
| JS-09 Cancelamento de Show | S-04 (Escala) + S-08 (Avisos) | ❌ Não |
| JM-06 Solicitação Negada | S-06 (Solicitações) | ❌ Não |
| JA-06 Conflito entre Supervisores | S-15 (Equipes/Grupos) + S-11 (Histórico) | ❌ Não |
| JS-06 Planejamento Semanal | S-02 (Painel Operacional, seção multi-horizonte) | ✅ Sim |
| Todas as demais | Superfícies mapeadas | ✅ Sim |

🟡 **JS-09, JM-06 e JA-06** existem como jornadas no documento de Jornadas mas não são referenciadas no campo "jornadas relacionadas" das superfícies que as suportam. Não é uma inconsistência estrutural — as superfícies existem e suportam as jornadas. É uma inconsistência de cross-referencing que precisa ser corrigida antes de usar os documentos como base de design.

**Parte B — Jornadas sem superfície real:**

Todas as 20 jornadas têm ao menos uma superfície que as suporta. Nenhuma jornada fica sem endereço.

**Conclusão Q2:** Nenhuma jornada está sem superfície. Há 3 jornadas sem referência cruzada explícita no mapa de superfícies — omissão de documentação, não de design.

---

## QUESTÃO 3 — Existe algum pilar da arquitetura sem representação adequada?

**Método:** Para cada pilar da arquitetura, verificar se existe superfície, jornada, ou representação como elemento contextual adequada.

| Pilar (Arquitetura) | Representação | Status |
|---|---|---|
| **Escala** | S-04 (superfície primária) | 🟢 |
| **Agenda** | S-12 (superfície secundária) | 🟡 Subrepresentada em jornadas |
| **Livro do Show** | S-13 (superfície eventual) | 🟢 |
| **Livro do Dia** | S-05 (superfície primária) | 🟢 |
| **Equipe** | S-15 (superfície administrativa) | 🟢 |
| **Folgas** | Embutido em S-06 (decisão documentada) | 🟢 |
| **Restrições** | Embutido em S-15 / contexto em S-04 (decisão documentada) | 🟢 |
| **Solicitações** | S-06 (superfície secundária) | 🟢 |
| **Entregas** | S-07 (superfície secundária) | 🟢 |
| **Avisos** | S-08 (superfície secundária) | 🟢 |
| **Mensagens** | S-09 (superfície secundária) | 🟢 |
| **Biblioteca / Manuais / Diretrizes / Procedimentos** | S-14 (superfície eventual) | 🟡 Jornada direta ausente |
| **IA** | S-10 (superfície secundária + embarcada) | 🟢 |
| **Operações** | S-16 (superfície administrativa) | 🟢 |
| **Configurações** | S-17 (superfície administrativa) | 🟢 |
| **Histórico / Auditoria** | S-11 (superfície secundária) | 🟢 |
| **Central de Notificações** | Infraestrutura — não é superfície (decisão documentada) | 🟢 |
| **Inbox Unificado** | Eliminado como superfície (decisão documentada) | 🟡 Tensão com arquitetura |
| **Meu Dia** | S-01 (superfície primária) | 🟢 |

**Achados:**

🟡 **Agenda subrepresentada:** A Agenda existe como pilar arquitetural e como superfície (S-12), mas sua representação nas jornadas é fraca. O Supervisor usa a Agenda como referência de data mas nenhuma jornada explora essa interação em profundidade. O risco para o design: o time pode criar uma superfície de Agenda excessivamente complexa ou excessivamente simples porque não tem jornadas de calibração.

🟡 **Inbox Unificado — tensão não resolvida formalmente:** O documento de arquitetura define o Inbox Unificado como uma entidade real ("consolida Mensagens, Avisos, Entregas, Solicitações, Eventos e Avaliações"). O mapa de superfícies o elimina como superfície com justificativa clara. Mas a arquitetura não foi atualizada para refletir essa decisão. Os dois documentos estão em conflito leve — não sobre design, mas sobre o que o produto é oficialmente.

**Recomendação:** Adicionar nota no documento de arquitetura: "O Inbox Unificado foi decidido como elemento contextual nas superfícies Mensagens e Solicitações, não como superfície independente no MVP."

**Conclusão Q3:** Todos os 19 pilares têm representação. Dois merecem atenção: Agenda (subrepresentada em jornadas) e Inbox Unificado (tensão de documentação entre arquitetura e superfícies).

---

## QUESTÃO 4 — Existe alguma sobreposição entre superfícies?

**Método:** Examinar pares de superfícies que compartilham propósito ou conteúdo para identificar sobreposição real vs. aparente.

**Par 1: S-08 (Avisos) vs. S-09 (Mensagens)**
Sobreposição: aparente. A distinção é bem definida e validada pela pesquisa:
- Aviso = broadcast unidirecional, documento com data
- Mensagem = conversacional bidirecional, contextual

🟡 **Risco de UX, não de arquitetura:** O problema não é que os conceitos se sobrepõem — é que a interface pode representá-los de forma visualmente similar, destruindo a distinção mental que o Membro construiu. A auditoria confirma que os conceitos são distintos; a interface precisa honrar isso com tratamento visual completamente diferente.

**Par 2: S-04 (Escala) vs. S-05 (Livro do Dia)**
Sobreposição: aparente. São perspectivas diferentes da mesma realidade:
- Escala = visão de calendário (quem está alocado em qual data)
- Livro do Dia = visão por show (posições específicas de uma data)

🟢 Conceitos distintos e bem documentados. A tensão de navegação está identificada — a interface precisa tornar o caminho entre as duas absolutamente claro.

**Par 3: S-02 (Painel Operacional) vs. S-04 (Escala)**
Sobreposição: aparente mas com risco de UX.
- Painel Operacional = diagnóstico e triagem
- Escala = ação operacional

🟡 O risco real: o Supervisor pode tentar resolver exceções diretamente no Painel Operacional (porque é mais conveniente), pulando a Escala, e perdendo a visibilidade de cascata que só existe na Escala. A interface precisa garantir que o Painel conduz à Escala para ação — não tenta substituí-la.

**Par 4: S-16 (Operações) vs. S-17 (Configurações)**
Sobreposição: potencial.
- Operações = gestão da unidade de negócio (criar, ativar, desativar)
- Configurações = parâmetros técnicos e permissões

🟡 Ambas são administrativas, ambas raramente usadas, ambas com usuário único (Admin). Há risco de que o usuário não saiba em qual das duas está a funcionalidade que precisa. Para o MVP, uma fusão em "Administração" com sub-seções distintas seria mais clara do que duas superfícies separadas de baixa frequência. Isso não é inconsistência — é uma oportunidade de simplificação.

**Par 5: S-11 (Histórico) vs. estados de itens dentro de cada superfície**
Sobreposição: nenhuma real.
- Estado de um item (ex.: status de uma solicitação) = visível dentro da própria superfície
- Histórico = investigação de eventos passados em profundidade

🟢 Distinção clara. Sem sobreposição.

**Conclusão Q4:** Nenhuma sobreposição estrutural real. Dois pares (S-08/S-09 e S-02/S-04) têm risco de sobreposição de UX que a interface precisa resolver visualmente. S-16/S-17 têm oportunidade de fusão para simplificação.

---

## QUESTÃO 5 — Existe alguma superfície que deveria ser fundida?

**Candidatas analisadas:**

**S-16 (Operações) + S-17 (Configurações) → Candidata a fusão**

Justificativa para fundir:
- Mesmo usuário (Admin)
- Mesma frequência (baixíssima)
- Mesma natureza (administrativo, não operacional)
- Risco de fragmentação: usuário não sabe em qual das duas encontrar o que precisa

Justificativa para manter separadas:
- Operações tem natureza de entidade de negócio (criar, renomear, desativar uma empresa)
- Configurações tem natureza técnica (permissões, notificações, integrações)

🟡 **Recomendação:** Unificar como superfície "Administração" com sub-seções "Operações" e "Configurações". Na navegação, o Admin vê um único destino "Administração" que internamente organiza os dois. Nível de impacto: baixo (são superfícies de uso raro). Não bloqueia o início do design.

**S-13 (Livro do Show) — candidata a absorção em S-16 (Operações)**

O Livro do Show é configurado uma vez, raramente alterado, e pertence ao contexto de setup de uma Operação. Em vez de uma superfície própria, poderia ser uma sub-seção dentro de "Operações" (ou "Administração" se fundida com Configurações).

🟡 **Recomendação:** Para o MVP, tratar Livro do Show como sub-seção de Operações/Administração, não como superfície independente. Na V2, quando existir demanda de edição frequente do Livro do Show, pode ganhar superfície própria.

---

## QUESTÃO 6 — Existe alguma superfície que deveria ser dividida?

**S-06 (Solicitações) — Membro vs. Supervisor**

A superfície tem lógicas radicalmente diferentes por perfil:
- Membro: cria e acompanha (perspectiva de requerente)
- Supervisor: analisa e decide com análise de impacto (perspectiva de aprovador)

A informação exibida é diferente. As ações possíveis são diferentes. A ordem de apresentação dos itens é diferente (Membro: cronológica por estado; Supervisor: por urgência de impacto operacional).

**Decisão:** NÃO dividir em duas superfícies. Manter como superfície única com **views por perfil** clara e distinta. Esse é um padrão estabelecido (requester/approver) e dividir criaria fragmentação de navegação sem benefício. A diferença é de view, não de superfície.

🟢 Superfície não precisa ser dividida. Precisa de design de view por perfil.

**S-15 (Equipes / Grupos) — estrutura vs. perfil individual**

A superfície atual conflate:
- Gestão estrutural (quais Grupos existem, quem é Supervisor de cada um) — território do Admin
- Perfil individual do membro (restrições, funções habilitadas, histórico pessoal) — território do Supervisor e do próprio Membro

**Decisão:** 🟡 Vale separar em design em duas views distintas dentro da mesma superfície administrativa:
- View de estrutura: Grupos → Membros (Admin)
- View de perfil: Membro individual → dados pessoais, funções, restrições (Admin e Supervisor)

Não é necessário criar duas superfícies separadas — mas o design precisa reconhecer que são dois contextos de uso completamente diferentes.

---

## QUESTÃO 7 — Existe alguma descoberta importante da pesquisa que não está representada nas superfícies?

**Verificação sistemática das 30 descobertas (10 por perfil):**

**Supervisor:**
- D1 (status → impacto → recomendação → cascata) → S-02 e S-04 representam ✅
- D2 (exceções inesperadas, visão do todo) → S-02 (triagem de exceções) ✅
- D3 (crise solo vs. planejamento) → S-02 diferencia urgência vs. planejamento ✅
- D4 (operação primeiro, pessoas depois — Livro do Dia como processo) → S-05 ✅
- D5 (cascata invisível) → S-04 (cascata explícita antes de confirmar) ✅
- D6 (confirmação como garantia de execução, não apenas envio) → S-08 (rastreamento de confirmação), S-09, princípio explícito em JS-05 ✅
- D7 (impacto acumulado de folgas, não individual) → S-06 (acumulado visível) ✅
- D8 (Livros como conhecimento operacional, não formulário) → S-05 (explícito na filosofia) ✅
- D9 (multi-horizonte — hoje, amanhã, semana) → S-02 (multi-horizonte presente) ✅
- D10 (IA: linguagem natural, contexto de crise vs. planejamento, mostra raciocínio) → S-10 ✅

**Membro:**
- D1 (segurança antes de informação — próxima atividade primeiro) → S-01 (estrutura de prioridade) ✅
- D2 (mudanças mais importantes que programação estável) → S-01 (alterações destacadas) ✅
- D3 (limbo = silêncio sem significado) → S-06 (estado sempre visível) ✅
- D4 (pedidos surgem naturalmente, formalização é incômoda) → S-06 (tipos acessíveis, não burocráticos) ✅
- D5 (entrega é ciclo, não evento único) → S-07 (ciclo completo com histórico) ✅
- D6 (Biblioteca = autonomia sem precisar perguntar) → S-14 + S-10 (IA como mediadora) ✅
- D7 (Aviso ≠ Mensagem; saber vs. responder) → S-08 e S-09 distintos ✅
- D8 (IA: intérprete pessoal, linguagem direta, escopo individual) → S-10 (persona do Membro) ✅
- D9 (confiança vem de consistência, não velocidade) → princípio em todas as superfícies ✅
- D10 (histórico como prova — "posso provar que não recebi") → S-11 e rastreamento de confirmação ✅

**Admin:**
- D1 (visão do ecossistema inteiro, não de uma operação) → S-03 ✅
- D2 (estrutura em camadas, cada camada tem responsabilidades) → S-15 e S-16 ✅
- D3 (medo de consequências invisíveis de mudanças estruturais) → S-15 e S-16 (impacto antes de confirmar) ✅
- D4 (onboarding e setup inicial — jornada não pesquisada) → JA-05 existe, mas com lacunas reconhecidas ✅
- D5 (histórico como narrativa investigativa, não log técnico) → S-11 (explicitamente narrativo) ✅
- D6 (replicação de erros para melhorar o padrão) → S-11 (detecção de reincidência) ✅
- D7 (saúde medida por: tempo de resposta, correções pós-publicação, escaladas) → S-03 (indicadores exatos) ✅
- D8 (itens sem responsável como sinal de risco) → S-03 (itens sem dono destacados) ✅
- D9 (IA: analista organizacional, padrões, tendências) → S-10 (persona do Admin) ✅
- D10 (raiz do problema estrutural vs. decisão individual) → S-11 + S-03 ✅

**Achado crítico — descoberta ainda não formalizada na arquitetura:**

🔴 **Alteração Operacional Persistente — comportamento não capturado na arquitetura:**

A pesquisa do Membro (D2: "mudanças persistem visíveis até confirmação") gerou uma decisão documentada na Auditoria de Cobertura e representada em S-01 (Meu Dia) e S-08 (Avisos). O Meu Dia declara: "Alterações críticas persistem até confirmação — não depende apenas do push."

Porém, o documento de arquitetura (Central de Notificações) define apenas 3 tipos: Informativo, Importante, Crítico — sem descrever o comportamento de "persistência até reconhecimento". A arquitetura e o mapa de superfícies estão em desacordo técnico sobre o comportamento das notificações de alteração operacional.

**Impacto:** Se o desenvolvimento for executado apenas com base na arquitetura, esse comportamento não será implementado. O MyASA precisará de atualização no documento de arquitetura antes do desenvolvimento.

**Conclusão Q7:** 29 das 30 descobertas estão representadas. A exceção é a Alteração Operacional Persistente — representada nas superfícies mas ausente da arquitetura.

---

## QUESTÃO 8 — Existe alguma inconsistência entre os três perfis?

**Verificação de conflitos de permissão, escopo e comportamento entre perfis:**

**Permissão de publicação da Escala:**

Arquitetura: *"Podem publicar: Admin e Supervisor."*
S-04 (Escala), campo "Público principal": *"Supervisor (constrói e publica). Admin (visualiza e monitora)."*

🔴 **Inconsistência real.** A superfície S-04 nega ao Admin a permissão de publicar que a arquitetura lhe concede. Se o design for baseado apenas no mapa de superfícies, o Admin não terá acesso à publicação — contrariando a arquitetura.

**Resolução necessária:** Atualizar S-04 para: "Supervisor (constrói e publica). Admin (visualiza, monitora e **pode publicar**). Membro nunca acessa diretamente."

---

**Criação de Entregas pelo próprio Membro:**

Arquitetura: *"Permissões de criação de Entregas — Membro: cria para si mesmo."*
S-07 (Entregas), campo "Público principal": *"Supervisor: cria, acompanha, avalia. Membro: recebe, executa, envia."*

🔴 **Omissão com impacto de design.** A superfície S-07 não menciona que o Membro pode criar Entregas para si mesmo. Isso não apenas é uma inconsistência com a arquitetura — altera o design da superfície. Se o Membro pode criar Entregas para si, S-07 precisa de um modo de criação pelo Membro (além do modo de execução). São padrões de interação distintos.

**Resolução necessária:** Atualizar S-07 para incluir: "Membro: recebe e executa Entregas criadas pelo Supervisor/Admin; **também pode criar Entregas para si mesmo** (tarefa pessoal ou autodesignada)."

---

**Escopo do Supervisor na Agenda:**

Arquitetura: *"Supervisor: Criar, editar, excluir dentro do seu escopo."*
S-12 (Agenda): *"Admin: cria e gerencia eventos oficiais. Supervisor: consulta para entender o que tem que cobrir."*

🟡 **Inconsistência de escopo.** A arquitetura concede ao Supervisor permissão de criar/editar/excluir eventos na Agenda dentro do seu escopo. O mapa de superfícies o limita a consulta. Qual é o comportamento correto?

Esta inconsistência tem origem na lacuna de pesquisa identificada na Auditoria de Cobertura: "Como o Supervisor usa a Agenda diariamente?" não foi investigado. A superfície tomou uma decisão de design (Supervisor = consulta) que pode ou não estar alinhada com o comportamento real.

**Resolução:** A decisão de design pode se manter (Supervisor apenas consulta), mas precisa ser explicitamente registrada como decisão consciente que **restringe** a permissão arquitetural por razão de UX (evitar conflito com eventos criados pelo Admin).

---

**Outros cruzamentos de perfil:**

| Verificação | Resultado |
|---|---|
| IA atua com permissões do usuário que a acionou | 🟢 Consistente |
| Membro nunca vê Escala diretamente | 🟢 Consistente |
| Membro nunca vê dados de outros Membros em Meu Dia | 🟢 Consistente |
| Restrições: Membro não registra, apenas reporta via Solicitação | 🟢 Consistente |
| Folgas: aprovação pertence ao Supervisor/Admin | 🟢 Consistente |
| Histórico disponível para Admin com profundidade de investigação | 🟢 Consistente |
| Painel de Saúde exclusivo ao Admin, não replicado para Supervisor | 🟢 Consistente |
| Livro do Show: Admin cria, Supervisor consulta | 🟢 Consistente (ver observação S-12 acima) |

**Conclusão Q8:** Duas inconsistências reais encontradas. Ambas são resolvíveis com atualização de documentação (não exigem redesenho de jornadas ou superfícies):
1. Admin pode publicar Escala (omitido em S-04)
2. Membro pode criar Entregas para si mesmo (omitido em S-07)

Uma inconsistência de escopo em S-12 (Agenda do Supervisor) precisa ser declarada como decisão de design consciente.

---

## QUESTÃO 9 — Existe alguma decisão tomada anteriormente que foi perdida ao longo do processo?

**Rastreamento de decisões-chave da arquitetura e pesquisa:**

| Decisão | Origem | Presente nas Jornadas? | Presente nas Superfícies? |
|---|---|---|---|
| Escala única por Operação | Arquitetura | ✅ JS-04 | ✅ S-04 |
| IA não executa sem confirmação explícita | Arquitetura | ✅ JS-03, JS-09 | ✅ S-10 |
| Mudança no Livro do Show não altera Livros do Dia já gerados | Arquitetura | ✅ JS-04 (implícito) | ✅ S-13 (tensão documentada) |
| Cancelamento de Show: pergunta "Impactar Escala?" | Arquitetura | ✅ JS-09 | 🟡 JS-09 não referenciado em S-04 ou S-08 |
| Características não viram módulos (apenas pilares) | Arquitetura | ✅ Respeitado | ✅ Folgas/Restrições não são superfícies |
| Notificações críticas exigem confirmação de leitura | Arquitetura | ✅ JS-05 | ✅ S-01, S-08 |
| IA age com permissões do usuário ativo | Arquitetura | ✅ Todos os perfis de IA | ✅ S-10 |
| Mobile First Real — toda tarefa crítica possível pelo celular | Diretrizes | ✅ JS-03 (Supervisor em movimento) | ✅ Implícito em todas as superfícies primárias |
| Alternativas de substituição: 4 camadas de classificação de risco | Jornadas | ✅ JS-03 | ✅ S-04 |
| Motivo de negativa de Solicitação é obrigatório | Jornadas | ✅ JS-02, JM-06 | ✅ S-06 |
| Confirmação de comunicação ≠ confirmação de compreensão | Diretrizes | ✅ JS-05 | ✅ S-08 |
| IA tem 3 personas: copiloto / intérprete / analista | Pesquisa → Jornadas | ✅ Todos os perfis de IA | ✅ S-10 |
| Três produtos em um (3 perfis com dados compartilhados) | Jornadas | ✅ Mapa consolidado | ✅ Princípio no mapa de superfícies |
| Alteração Operacional Persistente (4º comportamento) | Pesquisa → Auditoria de Cobertura | ✅ JM-02 | ✅ S-01, S-08 — mas ❌ ausente na arquitetura |
| Inbox Unificado eliminado como superfície | Superfícies | N/A | ✅ Documentado — mas ❌ não atualizado na arquitetura |

**Achado:**

🟡 **Cancelamento de Show (JS-09)** — decisão arquitetural importante ("pergunta se impacta Escala") está presente na jornada mas não referenciada explicitamente nas superfícies S-04 (Escala) ou S-08 (Avisos) como jornada relacionada.

🔴 **Dois comportamentos faltam na arquitetura:**
1. Alteração Operacional Persistente (comportamento novo descoberto na pesquisa)
2. Inbox Unificado eliminado como superfície (decisão do mapa de superfícies não refletida na arquitetura)

**Conclusão Q9:** As duas perdas identificadas não são de jornadas ou superfícies — são de documentação. As decisões existem e estão representadas corretamente no design, mas o documento de arquitetura precisa de duas atualizações para ficar sincronizado.

---

## SÍNTESE CONSOLIDADA DE ACHADOS

### Achados 🔴 Inconsistentes (exigem correção antes de avançar)

| # | Achado | Documento impactado | Correção necessária |
|---|---|---|---|
| R1 | Admin pode publicar Escala — omitido em S-04 | ux-superficies-myasa-2.0.md | Atualizar campo "Público principal" de S-04 |
| R2 | Membro pode criar Entregas para si mesmo — omitido em S-07 | ux-superficies-myasa-2.0.md | Atualizar campo "Público principal" de S-07 |
| R3 | Alteração Operacional Persistente ausente da arquitetura | arquitetura-myasa-2.0.md | Adicionar como 4º comportamento na seção Central de Notificações |

### Achados 🟡 Atenção (resolvíveis durante o design, não bloqueantes)

| # | Achado | Impacto | Recomendação |
|---|---|---|---|
| A1 | S-12 (Agenda) subrepresentada em jornadas | Risco de over/under-design da superfície | Declarar explicitamente que Supervisor = consulta na Agenda (decisão de design, não omissão) |
| A2 | S-14 (Biblioteca) sem jornada de acesso direto | Risco de superfície sem padrão de uso claro | Declarar: acesso primário via IA; acesso direto é exceção para usuários avançados |
| A3 | JS-09, JM-06, JA-06 não referenciados nas superfícies | Inconsistência de documentação | Adicionar cross-references nos campos "jornadas relacionadas" das superfícies afetadas |
| A4 | Inbox Unificado não atualizado na arquitetura | Tensão entre dois documentos | Adicionar nota na arquitetura sobre a decisão do MVP |
| A5 | S-16 e S-17 com potencial de fusão | Risco de fragmentação administrativa | Considerar fusão em "Administração" com sub-seções |
| A6 | S-13 (Livro do Show) como sub-seção vs. superfície | Risco de navegação fragmentada | Avaliar se Livro do Show é sub-seção de Operações no MVP |
| A7 | Escopo do Supervisor na Agenda (criar vs. consultar) | Permissão conflitante entre documentos | Registrar como decisão consciente de restrição de UX |
| A8 | S-02 vs. S-04: risco de resolução de exceções no Painel sem ir para Escala | Risco de UX, não de arquitetura | Incluir como princípio de navegação: Painel = diagnóstico, Escala = ação |

### Achados 🟢 Consistentes

- Todos os 12 princípios de arquitetura respeitados
- Todas as 30 descobertas de pesquisa representadas (29/30 nas superfícies, 1 na arquitetura)
- As 3 personas da IA consistentes em todos os documentos
- Fluxo obrigatório da IA (Proposta → Confirmação → Execução → Desfazer) presente em todas as superfícies relevantes
- Folgas e Restrições corretamente não transformadas em superfícies
- Distinção Aviso/Mensagem presente e fundamentada
- Histórico como narrativa (não log técnico) consistente
- "3 produtos em um" reconhecido no mapa de superfícies
- Princípio de Mobile First operacionalmente integrado
- Todas as 17 superfícies têm jornadas associadas (4 com jornadas apenas eventuais — aceitável)

---

## CORREÇÕES NECESSÁRIAS

Antes de iniciar o Design de Interface, aplicar as seguintes correções nos documentos:

**Correção 1 — arquitetura-myasa-2.0.md, seção "Central de Notificações":**
Adicionar após os 3 tipos existentes:

> *"Alteração Operacional Persistente: mudanças na Escala ou Livro do Dia que afetam o Membro permanecem visíveis no Meu Dia como elemento destacado até confirmação explícita. Diferente das notificações Importantes e Críticas (que são eventos de entrega), a Alteração Persistente é um estado — não desaparece até ser reconhecida."*

**Correção 2 — arquitetura-myasa-2.0.md, seção "Comunicação" / "Inbox Unificado":**
Adicionar nota:

> *"Decisão de MVP: O Inbox Unificado não será implementado como superfície independente. O acesso consolidado a Mensagens, Solicitações e Entregas é gerenciado via estados visíveis dentro de cada superfície. Revisão na V2."*

**Correção 3 — ux-superficies-myasa-2.0.md, S-04 (Escala), campo "Público principal":**
De: *"Supervisor (constrói e publica). Admin (visualiza e monitora)."*
Para: *"Supervisor (constrói e publica). Admin (visualiza, monitora e pode publicar). Membro nunca acessa diretamente."*

**Correção 4 — ux-superficies-myasa-2.0.md, S-07 (Entregas), campo "Público principal":**
Adicionar ao Membro: *"Membro: recebe e executa Entregas criadas pelo Supervisor/Admin; pode criar Entregas para si mesmo."*

**Correção 5 — ux-superficies-myasa-2.0.md, S-04 (Escala) e S-08 (Avisos):**
Adicionar JS-09 na lista de jornadas relacionadas de ambas as superfícies.

**Correção 6 — ux-superficies-myasa-2.0.md, S-06 (Solicitações):**
Adicionar JM-06 na lista de jornadas relacionadas.

**Correção 7 — ux-superficies-myasa-2.0.md, S-15 (Equipes/Grupos) e S-11 (Histórico):**
Adicionar JA-06 na lista de jornadas relacionadas de ambas.

---

## VEREDICTO FINAL

**O MyASA está pronto para iniciar Design de Interface?**

## ✅ SIM — com 3 pequenas correções aplicadas antes ou em paralelo ao início.

As 3 inconsistências críticas (R1, R2, R3) são correções de documentação de 5 a 10 minutos cada. Nenhuma exige redesenho de jornadas, mudança de arquitetura estrutural ou novo ciclo de pesquisa.

Os 8 pontos de atenção (A1–A8) são decisões de design que devem ser consideradas durante o processo — não são bloqueantes.

A fundação do produto é sólida:
- Arquitetura validada e consistente com as pesquisas
- Pesquisas com 30 descobertas, todas representadas nas superfícies
- 20 jornadas mapeadas com profundidade suficiente para guiar o design
- 17 superfícies identificadas com propósito, jornadas, riscos e relações definidas
- Sobreposições identificadas e justificadas (não são falhas — são tensões de design conhecidas)

---

## ORDEM DE DESIGN DE INTERFACE

As superfícies devem ser desenhadas nesta ordem, do maior impacto e maior frequência para o menor:

### Bloco 1 — Core do produto (design em paralelo)
Estas superfícies definem o produto. São a razão pela qual o usuário abre o MyASA.

| Ordem | Superfície | Justificativa |
|---|---|---|
| 1 | **S-01 Meu Dia** | Maior frequência de uso de todo o produto. Produto do Membro. Se falhar, falha o MVP. |
| 2 | **S-02 Painel Operacional** | Entrada diária do Supervisor. Define se o WhatsApp é substituído. |
| 3 | **S-04 Escala** | Fonte de verdade. Alimenta Meu Dia e Livro do Dia. Sem Escala funcional, tudo o mais é ficção. |

### Bloco 2 — Ciclo operacional completo
Superfícies que completam o dia a dia dos dois perfis mais ativos.

| Ordem | Superfície | Justificativa |
|---|---|---|
| 4 | **S-05 Livro do Dia** | Entrega de valor imediata do Supervisor pós-Escala. |
| 5 | **S-08 Avisos + S-09 Mensagens** | Comunicação operacional. Desenhadas juntas para garantir distinção visual. |
| 6 | **S-06 Solicitações** | Ciclo Membro→Supervisor mais frequente depois da programação diária. |

### Bloco 3 — IA embarcada
Desenhada não como superfície isolada, mas como elemento integrado ao design de cada superfície do Bloco 1 e 2.

| Ordem | Superfície | Justificativa |
|---|---|---|
| 7 | **S-10 IA (embarcada)** | Deve ser desenhada durante o design das superfícies anteriores — não depois. O padrão de UI da IA deve ser definido ao projetar S-01 e S-02. |

### Bloco 4 — Governança e apoio
Superfícies do Admin e apoio estrutural.

| Ordem | Superfície | Justificativa |
|---|---|---|
| 8 | **S-03 Painel de Saúde** | Home do Admin — desenhado após Bloco 1 para ter referência do que será monitorado. |
| 9 | **S-07 Entregas** | Ciclo completo menos frequente que Solicitações. |
| 10 | **S-11 Histórico** | Ferramenta de investigação — desenhada quando as superfícies que geram dados já existem. |
| 11 | **S-12 Agenda** | Calendário operacional — desenhado com clareza sobre o que é Agenda vs. Escala. |

### Bloco 5 — Administrativo e eventual
Superfícies de baixa frequência, alta consequência.

| Ordem | Superfície | Justificativa |
|---|---|---|
| 12 | **S-15 Equipes / Grupos** | Estrutura de pessoas — necessária para o piloto funcionar. |
| 13 | **S-16 + S-17 Operações / Configurações** | Fusão recomendada. Setup e manutenção da estrutura. |
| 14 | **S-13 Livro do Show** | Template estrutural — desenhado quando Livro do Dia já existe para referência. |
| 15 | **S-14 Biblioteca** | Repositório de conteúdo — desenhado por último; acesso via IA reduz urgência de UX dedicada. |
| 16 | **S-10 IA (chat dedicado)** | A superfície de chat livre é desenhada após a IA embarcada (Bloco 3) estar definida. |

---

*Auditoria concluída. Produto aprovado para Design de Interface.*
