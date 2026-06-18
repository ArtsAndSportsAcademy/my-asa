# MyASA 2.0 — Auditoria Final da Arquitetura Funcional

> **Versão:** 18/06/2026
> **Fase:** Auditoria — anterior ao início de UX em novas superfícies
> **Papel desta auditoria:** Auditor externo adversarial — objetivo é encontrar falhas, não confirmar o que foi feito
> **Base consultada:** todos os 28 documentos da pasta `docs/`, 121 decisões formais acumuladas
> **Status:** 🟡 Arquitetura funcionalmente sólida — 2 lacunas bloqueantes para UX · 4 ajustes importantes · 5 melhorias desejáveis

---

## Método da auditoria

Esta auditoria não valida o que foi produzido — ela tenta quebrá-lo. Cada seção parte do pressuposto de que a arquitetura está errada e busca evidência. Quando não encontra evidência de falha, declara o item encerrado. Quando encontra, classifica a severidade e propõe resolução.

**Fontes consultadas:**
- `ux-superficies-myasa-2.0.md` (974 linhas) — mapa oficial de todas as 17 superfícies
- `ciclo-planejamento-operacional-myasa-2.0.md` (1175 linhas) — ciclo operacional completo
- `ciclo-comunicacao-operacional-myasa-2.0.md` (1400 linhas) — ciclo de comunicação (S-05, S-08, S-11)
- `mudanca-operacional-myasa-2.0.md` (986 linhas) — entidade MO completa
- `ciclo-entregas-s07-myasa-2.0.md` (739 linhas) — fundação de S-07
- `governanca-organizacional-myasa-2.0.md` (809 linhas) — S-03, S-15, S-16, S-17
- `ecossistema-ia-myasa-2.0.md` (714 linhas) — IA nos 3 contextos
- `agenda-s12-myasa-2.0.md` (604 linhas) — S-12 Agenda
- `biblioteca-s14-myasa-2.0.md` (697 linhas) — S-14 Biblioteca
- wireframes: `wireframe-s01-meu-dia.md` (963 linhas), `wireframe-s02-painel-operacional.md`
- `wireframes-s13-livro-do-show-myasa-2.0.md` (1127 linhas)
- todos os demais documentos de UX, jornadas e arquitetura

---

## PARTE 1 — AUDITORIA DE COBERTURA

---

### Todas as atividades operacionais têm representação formal?

Mapeando as atividades centrais de uma ASA e verificando se cada uma tem representação formal no sistema:

| Atividade operacional | Superfície | Status |
|---|---|---|
| Membro sabe o que faz hoje | S-01 Meu Dia | ✅ Wireframe + definição completa |
| Supervisor opera o dia | S-02 Painel Operacional | ✅ Wireframe + definição completa |
| Alocação de quem trabalha quando | S-04 Escala | ✅ Mockup completo + comportamento |
| Documento do show do dia | S-05 Livro do Dia | ✅ Ciclo de Comunicação (1400 linhas) |
| Membro pede folga / restrição | S-06 Solicitações | ✅ Mockup completo + comportamento |
| Supervisor envia conteúdo obrigatório | S-07 Entregas | ⚠ Ver Achado A-01 |
| Aviso de mudança operacional | S-08 Avisos | ✅ Ciclo de Comunicação completo |
| Membro conversa com Supervisor | S-09 Mensagens | ❌ Ver Achado A-02 |
| IA auxilia em decisões | S-10 IA | ✅ Ecossistema completo (3 contextos) |
| Histórico auditável de eventos | S-11 Histórico | ✅ Ciclo de Comunicação completo |
| Calendário de shows e eventos | S-12 Agenda | ✅ Fundação completa |
| Template do espetáculo | S-13 Livro do Show | ✅ 3 documentos + wireframes |
| Repositório de conhecimento | S-14 Biblioteca | ✅ Fundação completa |
| Admin monitora saúde | S-03 Painel de Saúde | ✅ Governança completa |
| Estrutura de equipes | S-15 Equipes | ✅ Governança completa |
| Gestão de produções | S-16 Operações | ✅ Governança completa |
| Permissões e delegações | S-17 Administração | ✅ Governança completa |
| Mudança Operacional (entidade) | MO | ✅ Documento dedicado (986 linhas) |

**Cobertura: 16 de 17 superfícies com representação formal. Uma sem representação (S-09).**

---

### Existe alguma entidade sem responsável?

| Entidade | Responsável formal | Status |
|---|---|---|
| Livro do Show | Admin (estrutural) · Supervisor Tipo B (config) | ✅ |
| Livro do Dia | Supervisor | ✅ |
| Escala | Supervisor | ✅ |
| Solicitações | Membro (cria) · Supervisor (decide) | ✅ |
| Entregas | Supervisor · Admin | ✅ |
| Agenda | Admin (gestão) · Supervisor (consulta) | ✅ |
| Biblioteca — documentos | Responsável designado obrigatório | ✅ |
| Notificação (push) | ❌ Ver Achado A-03 | ❌ |
| Delegações expiradas sem ação | ❌ Ver Achado A-04 | ❌ |

---

### Existe alguma superfície sem propósito claro?

Verificação: cada superfície tem uma pergunta que responde, definida no mapa oficial.

**Resultado:** todas as 17 superfícies têm propósito explicitamente definido. Nenhuma foi criada sem pergunta-guia. ✅

---

## PARTE 2 — AUDITORIA DE FRONTEIRAS

---

### Agenda × Escala

**Sobreposição?** Não. Agenda responde "quando". Escala responde "quem está disponível". A interseção (evento na Agenda cria demanda na Escala) é intencional e documentada.

**Lacuna?** Nenhuma.

**Conflito?** Nenhum.

**Veredito: ✅ Fronteira limpa.**

---

### Escala × Livro do Dia

**Sobreposição?** Risco apontado no próprio `ux-superficies-myasa-2.0.md`: *"Escala e Livro do Dia representam coisas diferentes: a Escala é quem está alocado em qual data (visão de calendário), o Livro do Dia é como um show específico está escalado naquela data (visão por espetáculo)."* O risco está documentado e a distinção está formalizada.

**Lacuna?** Nenhuma nova.

**Conflito?** Nenhum.

**Veredito: ✅ Fronteira limpa com risco de UX documentado.**

---

### Livro do Dia × Avisos

**Sobreposição?** O Ciclo de Comunicação (1400 linhas) audita essa fronteira explicitamente e conclui: *"não existe duplicação real — existe coerência necessária."* O Livro do Dia é estado presente; o Aviso é o ato de comunicação da mudança; o Histórico é o registro causal. Perspectivas distintas da mesma realidade.

**Lacuna identificada:** quando o Livro do Dia é republicado e o Aviso é gerado automaticamente, o membro recebe o Aviso e vê o Meu Dia atualizado — mas em nenhum lugar está formalmente definido **o que acontece se o membro recebe o Aviso mas o Meu Dia ainda não atualizou** (janela de inconsistência transiente entre publicação e propagação). Essa janela pode ser millisegundos ou segundos, mas ela existe e seu comportamento (o Aviso chega antes do Meu Dia mostrar a mudança) não foi modelado.

**Severidade:** Baixa — ajuste de especificação técnica, não de produto.

**Veredito: ✅ Fronteira limpa / ⚠ janela de consistência transiente não modelada.**

---

### Avisos × Meu Dia

**Sobreposição?** Sim — intencional e documentada. O Aviso é persistente e rastreável; o Meu Dia é contextual ao dia e desaparece após confirmação. O `ciclo-comunicacao-operacional-myasa-2.0.md` formaliza essa distinção.

**Lacuna?** Nenhuma.

**Conflito?** Nenhum.

**Veredito: ✅ Fronteira limpa.**

---

### Meu Dia × Histórico

**Sobreposição?** Não — o Meu Dia é presente e contextual; o Histórico é passado e auditável. Nenhum elemento do Meu Dia tenta responder "o que aconteceu antes?"

**Lacuna identificada:** o que acontece com o "Aviso de mudança" que o Membro recebeu no Meu Dia quando a data do show passa? Ele some do Meu Dia — mas vai para o Histórico do Membro como evidência de ciência? O `ciclo-comunicacao-operacional-myasa-2.0.md` registra que o Histórico contém "quem confirmou, quando" — mas a transição específica do Meu Dia para o Histórico (o momento de arquivamento) não foi modelada.

**Severidade:** Baixa — comportamento implícito, mas não explicitado.

**Veredito: ⚠ Transição implícita não documentada — ajuste menor.**

---

### Entregas × Biblioteca

**Sobreposição?** Documentada e resolvida pela regra anti-duplicação: o conteúdo vive na Biblioteca, a Entrega referencia. Fronteira formal.

**Conflito identificado:** a regra diz "Entrega referencia a Biblioteca". Mas os 4 tipos de Entrega do MVP (Leitura Obrigatória, Vídeo, Atualização Operacional, Checklist) descrevem conteúdo criado dentro da própria Entrega — não necessariamente em um documento da Biblioteca. Um Supervisor pode criar uma Leitura Obrigatória com texto escrito diretamente na Entrega sem criar um item na Biblioteca. Isso não viola a regra, mas cria uma distinção que não foi formalizada: **Entrega com conteúdo nativo** vs. **Entrega que referencia Biblioteca**. O UX precisará tratar esses dois casos diferentemente.

**Severidade:** Média — não é uma falha de arquitetura, mas cria ambiguidade de UX não resolvida.

**Veredito: ⚠ Distinção nativo vs. referenciado não formalizada — ajuste antes do UX.**

---

### Livro do Show × Biblioteca

**Sobreposição?** Não — modelado explicitamente como relação de referência. O Livro do Show referencia itens da Biblioteca para enriquecer posições. Nenhuma duplicação.

**Lacuna?** Nenhuma.

**Veredito: ✅ Fronteira limpa.**

---

### IA × Todas as superfícies

**Contexto suficiente?** A IA opera com as permissões do usuário ativo — acessa apenas os dados que o usuário poderia acessar manualmente. Isso é formal e consistente em todos os 3 contextos (Membro, Supervisor, Admin).

**Conflito de escopo:** em nenhum documento foi formalmente resolvido o que acontece quando a IA do Supervisor faz uma ação (como sugerir uma substituição) e o Supervisor confirma — **a IA age com as permissões do Supervisor ou cria uma entidade separada de "ação da IA"?** O `ecossistema-ia-myasa-2.0.md` diz que toda ação da IA é rastreada no Histórico, mas não especifica se a ação é atribuída ao Supervisor (que confirmou) ou à IA (que propôs).

**Severidade:** Importante — afeta auditoria, responsabilidade e desenvolvimento.

**Conflito de disponibilidade:** a IA é descrita como não-bloqueante ("o produto funciona sem IA"). Mas nenhum documento especifica formalmente quais features ficam degradadas quando a IA está indisponível. Isso cria incerteza de desenvolvimento: qual é a versão sem IA de cada superfície?

**Severidade:** Importante — ver Achado A-05.

**Veredito: ⚠ Dois conflitos importantes identificados.**

---

## PARTE 3 — AUDITORIA DE CICLOS

---

### Ciclo de Planejamento Operacional

O ciclo está formalmente modelado em `ciclo-planejamento-operacional-myasa-2.0.md` (1175 linhas): Solicitação → Escala → Livro do Dia → Avisos → Meu Dia → Confirmação → Histórico.

**Estado sem saída?** Verificado: cada estado tem transição definida.

**Evento sem consequência?** Verificado: não existe ação no ciclo que não propague para outra entidade.

**Lacuna identificada:** o ciclo trata apenas de Solicitações aprovadas. O que acontece quando o Supervisor **altera a Escala diretamente** (sem Solicitação — apenas realloca uma posição)? O `mudanca-operacional-myasa-2.0.md` lista "Supervisor altera alocação diretamente na Escala" como evento que gera MO — o que é correto. Mas o caminho completo dessa ação (Escala alterada diretamente → MO → Aviso → Meu Dia atualizado) não tem um diagrama de ciclo equivalente ao das Solicitações.

**Severidade:** Baixa — o comportamento existe nos documentos individualmente, mas a visão integrada do ciclo de "mudança direta" está implícita, não explícita.

**Veredito: ✅ Ciclo principal completo / ⚠ sub-ciclo de mudança direta implícito.**

---

### Ciclo de Comunicação Operacional

Completamente modelado (1400 linhas). S-05, S-08 e S-11 têm definições oficiais, estados formais e relações entre si formalizadas.

**Veredito: ✅ Ciclo completo.**

---

### Ciclo de Entregas (S-07)

**ACHADO CRÍTICO — ver A-01.** O ciclo modelado na fundação de S-07 diverge do modelo original na definição de superfícies. A auditoria tratará isso como achado separado.

---

### Ciclo da Agenda

Estados formais completos (5 estados, transições documentadas). Cascatas para Livro do Dia documentadas.

**Estado sem saída?** ARQUIVADO é terminal — correto. REALIZADO é terminal — correto. CANCELADO é terminal — correto.

**Veredito: ✅ Ciclo completo.**

---

### Ciclo do Livro do Show

3 documentos dedicados cobrindo criação, recuperação arquitetural, lacunas e versionamento. O ciclo de versionamento (LS-D04) é o mais complexo e está completamente modelado.

**Veredito: ✅ Ciclo completo.**

---

### Ciclo de Governança

Sequência de setup obrigatória definida (S-17 → S-15 → S-16 → S-13 → Agenda → S-03). Ciclos de vida de Equipes e Operações modelados. Delegações com regras formais.

**Estado sem saída em Operação?** PAUSADO pode ficar eternamente pausado sem transição forçada — o sistema não força arquivamento. Isso é intencional (organizações pausam por tempo indefinido), mas cria uma situação onde Operações mortas persistem como PAUSADO sem sinal de degradação. Sem alerta para o Admin.

**Severidade:** Baixa — o Painel de Saúde poderia alertar sobre Operações pausadas por mais de N dias, mas isso não foi especificado.

**Veredito: ✅ Ciclo completo / ⚠ Operação pausada indefinidamente sem alerta.**

---

## PARTE 4 — AUDITORIA DE RESPONSABILIDADE

---

### Fluxo: Livro do Dia publicado com posições Em Aberto

| Momento | Dono |
|---|---|
| Supervisor publica com Em Aberto | Supervisor (escolhe publicar mesmo assim) |
| Aviso enviado aos afetados | Supervisor |
| Posição Em Aberto persiste no dia do show | ? |
| Admin é notificado? | ? |
| Quem resolve no dia do show? | ? |

**Lacuna:** após a publicação com Em Aberto, o ciclo de resolução não tem dono formal. O sistema registra a posição como Em Aberto — mas não especifica: (a) quando a posição Em Aberto escala para o Admin, (b) se o Supervisor deve resolver antes do início do show ou pode publicar assim e resolver no dia, (c) se existe um prazo após o qual a posição Em Aberto em um show PUBLICADO se torna estado de Risco no Painel de Saúde.

**Severidade:** Importante — a posição Em Aberto pós-publicação é um caso operacional real e frequente. O dono da resolução no dia do show não está formalizado.

---

### Fluxo: Conflito de membro em duas Operações simultâneas

| Momento | Dono |
|---|---|
| Motor detecta conflito | Sistema (sinaliza) |
| Supervisores de ambas as Operações são alertados | Sistema |
| Decisão de qual Operação tem prioridade | Admin (GOV-D09) |
| Como o Admin comunica a decisão? | ? |
| Como a decisão vira uma alocação no Livro do Dia? | ? |
| Qual tipo de MO é gerada? | ? |

**Lacuna:** a decisão de tiebreaker foi atribuída ao Admin, mas o processo de como essa decisão é tomada e executada não existe. Não há Solicitação Administrativa para isso, não há tipo de MO mapeado, não há fluxo formal. O Admin decide — mas onde, como, com qual ferramenta?

**Severidade:** Importante — organizações com múltiplas Operações simultâneas vão encontrar esse conflito regularmente.

---

### Fluxo: Ação da IA confirmada pelo Supervisor — quem é o autor?

| Ação | IA propõe · Supervisor confirma |
|---|---|
| MO gerada — autor: | Supervisor ou IA? |
| Aviso enviado — de: | Supervisor ou Sistema? |
| Histórico registra — ação de: | Supervisor (confirmou) ou IA (propôs)? |

**Lacuna:** o `ecossistema-ia-myasa-2.0.md` afirma que ações da IA são rastreadas, mas não define o modelo de atribuição. Em auditoria, a distinção entre "Supervisor fez" e "IA propôs e Supervisor confirmou" é relevante para responsabilidade.

**Severidade:** Importante — afeta auditoria, responsabilidade legal e desenvolvimento do Histórico.

---

### Fluxo: Supervisor substituto (não delegado) faz mudanças operacionais

| Ação | Dono |
|---|---|
| Substituição emergencial definida | Admin ou Supervisor designado |
| Supervisor substituto publica Livro do Dia | Supervisor substituto |
| MO gerada — autor: | Supervisor substituto |
| Histórico registra: | "Supervisor substituto [nome] — em substituição de [nome original]"? |

**Lacuna:** o modelo de substituição foi modelado (GOV) com a distinção de Delegação formal vs. Substituição operacional pontual. Mas o rastro no Histórico para uma substituição não planejada não foi especificado. O Histórico deve mostrar que a ação foi feita por um substituto? Isso importa para auditoria.

**Severidade:** Baixa — comportamento implícito; ajuste de especificação.

---

## PARTE 5 — AUDITORIA DE IA

---

### A IA tem contexto suficiente?

**Supervisor:** a IA do Supervisor opera com contexto de: Escala, Livro do Dia, Solicitações pendentes, histórico do grupo. Suficiente para as jornadas documentadas.

**Membro:** a IA do Membro opera com contexto de: Meu Dia, Solicitações próprias, Entregas pendentes, Biblioteca. Suficiente.

**Admin:** a IA do Admin opera com contexto de: Painel de Saúde, todas as Operações, Histórico organizacional, Biblioteca. Suficiente.

**Contexto ausente que a IA deveria ter:** Nenhum crítico identificado para o MVP.

---

### Existe informação que a IA recebe mas não deveria?

**Achado:** a IA do Supervisor, ao calcular cobertura, acessa as restrições de todos os membros do grupo — incluindo restrições de natureza médica (CAT-04, CAT-05). A IA vê "Membro X tem restrição por gestação" para calcular disponibilidade. Essa informação é **necessária para o cálculo** — mas é a IA o canal correto para expor esse dado? O Supervisor já vê restrições na Escala; a IA usar esse dado é coerente. Mas nenhum documento explicitamente declarou que a IA tem acesso a dados de restrições sensíveis (CAT-04/05/06) — apenas que o Supervisor tem.

**Severidade:** Baixa — comportamento provavelmente correto, mas a autorização explícita da IA para dados sensíveis nunca foi declarada formalmente.

---

### Existe conflito entre explicabilidade e privacidade?

**Achado:** a IA do Admin, ao narrar padrões de saúde organizacional, pode precisar referenciar comportamentos de indivíduos ("o padrão de restrições desta Equipe sugere sobrecarga"). Isso cria uma tensão: o Admin precisa do diagnóstico, mas a IA do Admin não deve expor dados individuais — apenas padrões agregados. O `ecossistema-ia-myasa-2.0.md` (IA-D10) proíbe linguagem avaliativa sobre Supervisores. Mas não proíbe explicitamente que a IA do Admin nomeie membros ao descrever padrões de restrição.

**Severidade:** Importante — a fronteira entre diagnóstico organizacional e exposição individual de dados sensíveis não foi formalmente traçada para a IA do Admin.

---

### IA indisponível — modo degradado

**Achado:** O produto foi declarado "funciona sem IA" como princípio. Mas nenhum documento especifica formalmente:
- Quais features são nativas (sem IA) vs. IA-dependentes
- O que o Supervisor vê no Painel Operacional quando a IA está offline
- Se a geração automática de proposta do Livro do Dia depende da IA ou é motor de regras puro
- Se a classificação de candidatos a substituto (4 camadas) requer IA ou é algoritmo determinístico

Essa distinção importa enormemente para desenvolvimento: motor de regras vs. modelo de linguagem têm infraestruturas completamente diferentes.

**Severidade:** Importante — ver Achado A-05.

---

## PARTE 6 — AUDITORIA DE GOVERNANÇA

---

### A organização consegue operar por anos sem degradar a arquitetura?

**Riscos de degradação identificados:**

**Risco 1 — Livro do Show sem revisão:** um template de show atualizado pela última vez há 2 anos, com a Operação ativa usando-o, não gera nenhum sinal de alerta. A Biblioteca tem revisão periódica configurável para Procedimentos de Segurança — o Livro do Show não tem equivalente. Uma organização pode rodar com um template de 3 anos sem perceber que precisa de revisão.

**Severidade:** Importante — degradação silenciosa.

**Risco 2 — Operação PAUSADA indefinidamente:** identificado na Parte 3. Sem alerta para Admin após N dias pausado.

**Risco 3 — Banco de candidatos silenciosamente eroso:** membros deixam a organização, são removidos das Equipes, e o banco de candidatos de posições diminui. O Painel de Saúde alerta quando o banco está abaixo do mínimo — mas o processo de reposição (trazer novos membros, qualificá-los) não tem ciclo formal.

**Severidade:** Baixa — o sistema detecta o problema; o processo de resolução é humano.

---

### Existe dependência excessiva do Admin?

**Achado:** para organizações com múltiplas Operações, o Admin é o único criador de Operações, o único arquivador de Operações, o único criador de templates de Livro do Show, o único designador de categorias na Biblioteca, o único resolvedor de conflitos de Operações simultâneas. Em uma organização com 10 Operações simultâneas e 1 Admin, esse Admin é um gargalo estrutural.

A lacuna LG-02 (permissões granulares por Operação para Supervisores) foi identificada e catalogada como V2. Mas a escala de impacto desse gargalo não foi avaliada quantitativamente.

**Avaliação:** para 1-3 Operações — ok. Para 5+ Operações — o Admin se torna um gargalo operacional que degrada a velocidade do produto.

---

### Existe entidade sem governança?

| Entidade | Governança definida? |
|---|---|
| Livro do Show | ✅ Admin (estrutural) + Supervisor (config) |
| Livro do Dia | ✅ Supervisor |
| Escala | ✅ Supervisor |
| Agenda | ✅ Admin (gestão) |
| Biblioteca | ✅ Responsável obrigatório |
| MO | ✅ Sistema (geração) + Supervisor/Admin (contexto) |
| Notificação (push) | ❌ Não governada — ver Achado A-03 |

---

## PARTE 7 — AUDITORIA DE ESCALABILIDADE

---

### Simulação: 1 Operação

O sistema foi desenhado para este caso. Todos os ciclos operam perfeitamente. Admin, Supervisor e Membro têm escopos claros. ✅

---

### Simulação: 3 Operações

Funciona bem. O Admin gerencia 3 Operações com escopos separados. A IA do Admin agrega as 3 no Painel de Saúde. Supervisores têm visibilidade restrita ao próprio escopo. ✅

---

### Simulação: 10 Operações simultâneas

**Onde começa a pressão:**

- O Admin gerencia 10 Livros do Show, 10 Operações, estrutura de Equipes para cada uma — volume de configuração alto
- O Painel de Saúde agrega 10 Operações — risco de sobrecarga cognitiva se a IA não priorizar com precisão
- Conflitos de membros entre Operações tornam-se frequentes — processo de resolução informal começa a escalar
- Notificações para o Admin sobre 10 Operações: volume não especificado de alertas simultâneos

**Pilares que sofrem:** Governança (Admin gargalo), Saúde (volume de alertas).

---

### Simulação: 50 Supervisores

- Cada Supervisor opera de forma independente dentro do seu escopo — o modelo escala bem
- O Admin recebe alertas de 50 Supervisores: Livros atrasados, posições Em Aberto, Entregas expiradas sem resposta
- **Não existe mecanismo de priorização de alertas para o Admin** — todos os alertas chegam com igual urgência
- A IA do Admin precisaria de um modelo de priorização que não foi formalizado

**Ponto de falha:** o Admin com 50 Supervisores experimenta fadiga de alerta sem mecanismo de triagem.

---

### Simulação: 500 Membros

- O motor de cobertura opera em escala — foi projetado para isso
- Onboarding manual de 500 membros é **operacionalmente impossível** no MVP — LG-04 (integração com RH) foi catalogada como V2, mas não há escape hatch de curto prazo (ex.: upload em massa de CSV)
- A Biblioteca sem busca/filtro formal torna-se inacessível com 50+ documentos
- A Escala com 500 membros requer filtros avançados para ser navegável — os filtros de Escala não foram especificados além de "por grupo"

**Pilares que sofrem:** onboarding (sem bulk import), Biblioteca (sem busca), Escala (sem filtros avançados).

---

## PARTE 8 — AUDITORIA DE FALHA

---

### Supervisor ausente sem delegação prévia

**Comportamento atual:** Equipe entra em estado de Risco. Admin é alertado. Admin designa substituto ou cria delegação de emergência.

**Lacuna:** e se o Admin também não está disponível no momento da ausência imprevista do Supervisor, e o show é em 4 horas? O sistema entra em estado de Risco — mas ninguém pode agir. Não existe procedimento de escalada de emergência sem Admin disponível.

**Severidade:** Baixa (edge case extremo) — mas operacionalmente real em organizações pequenas com 1 Admin.

---

### Admin ausente

**Comportamento atual:** sistema declara que a recomendação é ter 2 Admins. Se há 2 Admins, o segundo cobre. Se há 1 Admin, sistema entra em modo de contingência para mudanças estruturais.

**Status:** adequadamente modelado. ✅

---

### Equipe sem Supervisor ativo

**Comportamento atual:** estado de Risco imediato, publicação de Livros do Dia bloqueada, Admin alertado.

**Status:** modelado. ✅

---

### Operação suspensa

**Comportamento atual:** estado PAUSADO — novas datas não entram na Agenda, Livros do Dia existentes preservados.

**Status:** modelado. ✅

---

### Livro do Show desatualizado

**Comportamento atual:** versionamento (LS-D04) controla. Mudança estrutural gera novo template. Livros do Dia existentes mantêm a versão anterior até republicação.

**Status:** modelado. ✅

---

### Biblioteca sem responsável

**Comportamento atual:** Admin alertado imediatamente. Documentos permanecem acessíveis. IA continua consultando.

**Status:** modelado. ✅

---

### Membro que nunca confirma Entrega

**Comportamento atual:** EXPIRADA com registro permanente. Supervisor tem evidência. Show não é bloqueado.

**Status:** modelado. ✅

---

### IA indisponível

**Comportamento atual:** o produto declara "funciona sem IA". Mas o que especificamente o Supervisor vê no lugar da proposta automática de cobertura? O que o Membro vê no lugar do resumo do dia? Existe um "modo offline de IA" com comportamento definido?

**Lacuna:** não existe especificação de modo degradado. O desenvolvedor que implementar a feature de cobertura automática não sabe se ela é motor de regras (que funciona sem LLM) ou chamada de IA (que falha sem LLM). Ver Achado A-05.

---

## PARTE 9 — AUDITORIA FILOSÓFICA

---

### O produto ainda responde as três perguntas originais sem conhecimento técnico?

---

**Supervisor: "O que mudou?"**

Através de: S-02 Painel Operacional (exceções priorizadas), S-08 Avisos (o que foi comunicado), S-11 Histórico (o que aconteceu e por quê), IA do Supervisor (narrativa contextualizada).

A pergunta é respondida em múltiplas camadas com progressão de profundidade. O Supervisor começa pelo Painel (triagem), vai ao Livro do Dia (detalhe), consulta o Histórico (contexto) e a IA explica (narrativa).

**Veredito: ✅ Respondida com excelência.**

---

**Membro: "O que preciso fazer?"**

Através de: S-01 Meu Dia (alocação, mudanças, entregas pendentes, confirmações), IA do Membro (resumo em linguagem pessoal).

**Tensão identificada:** o Meu Dia agrega Alocação + Avisos + Entregas + Solicitações em andamento. Todos corretos. Mas a hierarquia visual entre esses itens — qual aparece no topo? qual recebe mais destaque? quando um Aviso urgente supera a alocação no topo? — não está definida no comportamento, apenas no wireframe. O wireframe existe (963 linhas), mas não há uma hierarquia de urgência formal em linguagem de produto.

**Severidade:** Baixa — o wireframe trata disso implicitamente, mas a regra de hierarquia de urgência no Meu Dia nunca foi declarada como decisão formal de produto.

**Veredito: ✅ Respondida / ⚠ hierarquia de urgência não formalizada como decisão de produto.**

---

**Admin: "A operação está saudável?"**

Através de: S-03 Painel de Saúde (4 estados com limiares configuráveis), IA do Admin (diagnóstico narrativo), Histórico (padrões), Governança (estrutura de equipes e operações).

**Veredito: ✅ Respondida com excelência.**

---

## PARTE 10 — ACHADOS FORMAIS E VEREDITO

---

## ACHADOS FORMAIS

---

### 🔴 A-01 — Divergência conceitual em S-07 Entregas

**Tipo:** Inconsistência entre documentos
**Severidade:** Bloqueante para UX de S-07

**O problema:**
A definição original de S-07 em `ux-superficies-myasa-2.0.md` descreve uma superfície de **gestão de tarefas com ciclo de avaliação**:
- Estados: *"aguardando envio / enviada / em análise / aprovada / ajuste solicitado"*
- Supervisor **avalia** a entrega do Membro
- Membro **pode criar Entregas para si mesmo**
- Conceito: expectativa → execução → **avaliação**

A fundação comportamental produzida em `ciclo-entregas-s07-myasa-2.0.md` descreve uma superfície de **atribuição de conteúdo obrigatório com compliance verificável**:
- Estados: *"CRIADA → PUBLICADA → RECEBIDA → VISUALIZADA → CONCLUÍDA"*
- Supervisor **monitora conclusão** — não avalia conteúdo
- Membro **não pode criar Entregas**
- Conceito: atribuição → leitura/visualização → **confirmação**

**Esses são dois produtos diferentes.** O primeiro é para tarefas criativas e operacionais (escrever um relatório, preparar uma cena, montar um figurino). O segundo é para compliance de conteúdo (ler o briefing, assistir ao vídeo, confirmar a política).

**Impacto:** iniciar UX de S-07 com essa divergência garante retrabalho. O designer implementará algo que diverge do comportamento modelado.

**Resolução necessária:** decisão explícita do Product Owner — qual é o S-07 do MVP?
- Opção A: compliance de conteúdo obrigatório (a fundação que foi produzida)
- Opção B: gestão de tarefas com avaliação (a definição original)
- Opção C: os dois como sub-tipos dentro da mesma superfície (escopo ampliado)

---

### 🔴 A-02 — S-09 Mensagens sem fundação comportamental

**Tipo:** Superfície sem modelagem de comportamento
**Severidade:** Bloqueante para UX de S-09

**O problema:** S-09 Mensagens tem uma definição de superfície em `ux-superficies-myasa-2.0.md` (objetivo, público, frequência, riscos) — mas não tem fundação comportamental. As seguintes perguntas ficam sem resposta:

- O que é uma Mensagem — qual entidade formal?
- Qual é o thread model: conversas sequenciais? ou mensagens soltas?
- Quem pode enviar para quem? (Membro pode enviar para Admin? Supervisor pode mandar broadcast?)
- Uma Mensagem pode ser deletada? por quem?
- Mensagem contextual (dentro de uma Solicitação ou Entrega) vs. Mensagem direta — são a mesma entidade ou entidades diferentes?
- Existe estado de "não lida"? Como é tratada a confirmação de leitura?
- A IA participa de conversas? pode responder no lugar do Supervisor?
- O que vai para o Histórico: todas as mensagens, ou apenas as que têm relevância operacional?
- Mensagens têm prazo de expiração?

**Impacto:** S-09 é referenciada em 11 outras superfícies como canal de comunicação. Sem comportamento modelado, o UX de S-09 não tem base. E o UX das superfícies que a referenciam (Entregas, Solicitações) fica incompleto.

**Resolução necessária:** fundação comportamental completa de S-09, equivalente às demais.

---

### ⚠ A-03 — Infraestrutura de Notificação sem especificação

**Tipo:** Entidade crítica sem comportamento definido
**Severidade:** Importante para desenvolvimento

**O problema:** Notificação (push) foi explicitamente excluída como superfície (*"é infraestrutura de entrega"* — `ux-superficies-myasa-2.0.md`). Essa decisão é correta do ponto de vista de UX. Mas o comportamento da infraestrutura de notificação nunca foi especificado:

- Como Avisos chegam ao Membro: push? in-app? email? todos?
- O que acontece quando o membro não abre a notificação? retry automático?
- Existe hierarquia de urgência nas notificações? (Aviso crítico de cancelamento de show > Lembrete de Entrega?)
- Notificações chegam para membros offline? quando sincronizam?
- Existe confirmação de entrega da notificação (diferente de confirmação de leitura do Aviso)?

**Impacto:** o desenvolvimento de todo o sistema de comunicação depende dessa especificação. Sem ela, cada desenvolvedor implementará notificações de forma diferente.

---

### ⚠ A-04 — Processo de resolução de conflito de Operações sem mecanismo formal

**Tipo:** Decisão sem fluxo de execução
**Severidade:** Importante

**O problema:** GOV-D09 declara que quando um membro está em dois eventos de Operações diferentes na mesma data, "a prioridade é decisão do Admin." Mas não existe:
- Tipo de Solicitação para esse conflito
- Tipo de MO para registrar a decisão
- Fluxo de como o Admin comunica a decisão aos dois Supervisores
- Estado formal do membro durante o período de conflito não resolvido

O Admin "decide" — mas onde, como, e como a decisão se propaga?

---

### ⚠ A-05 — Modo degradado da IA sem especificação

**Tipo:** Princípio declarado sem comportamento definido
**Severidade:** Importante para desenvolvimento

**O problema:** o sistema declara "funciona sem IA" — mas não especifica:
- Quais features são **motor de regras determinístico** (sempre funcionam, IA apenas enriquece)
- Quais features são **IA-dependentes** (não funcionam ou ficam degradadas sem LLM)
- O que o usuário vê quando a IA está offline em cada superfície

**Hipótese do auditor:** a proposta automática de cobertura do Livro do Dia (candidatos ranqueados por 4 camadas) é provavelmente um algoritmo determinístico — pode funcionar sem IA. O resumo narrativo do Painel de Saúde ("A operação está saudável porque...") é provavelmente IA — não funciona sem LLM. Mas isso nunca foi declarado.

---

### ◆ A-06 — Hierarquia de urgência no Meu Dia não formalizada como decisão de produto

**Tipo:** Comportamento implícito em wireframe mas não como decisão formal
**Severidade:** Desejável

**O problema:** o wireframe de S-01 trata a hierarquia visualmente. Mas não existe uma regra formal de produto: *"se há Aviso urgente + Entrega urgente + show em menos de 24h, o topo do Meu Dia mostra X porque Y."*

---

### ◆ A-07 — Biblioteca sem busca formal especificada

**Tipo:** Feature ausente que bloqueia usabilidade em escala
**Severidade:** Desejável (crítico para 50+ documentos)

---

### ◆ A-08 — Conteúdo nativo vs. referenciado na Entrega não distinguido formalmente

**Tipo:** Ambiguidade de UX
**Severidade:** Desejável

---

### ◆ A-09 — Livro do Show sem revisão periódica configurável

**Tipo:** Risco de degradação silenciosa
**Severidade:** Desejável

---

### ◆ A-10 — Onboarding de membros sem escape hatch para escala

**Tipo:** Operacionalidade em escala
**Severidade:** Desejável (crítico para 100+ membros)

---

## INVENTÁRIO FINAL

---

### 🔴 Lacunas críticas — bloqueiam UX das superfícies afetadas

| # | Achado | Superfície bloqueada | Resolução |
|---|---|---|---|
| A-01 | Divergência conceitual em S-07 | S-07 | Decisão do PO: qual S-07 vai para o MVP |
| A-02 | S-09 sem fundação comportamental | S-09 | Fundação comportamental completa |

---

### ⚠ Lacunas importantes — não bloqueiam UX mas criam risco de desenvolvimento

| # | Achado | Impacto | Resolução |
|---|---|---|---|
| A-03 | Notificação sem especificação | Desenvolvimento do sistema de comunicação | Spec técnica de Notificação |
| A-04 | Conflito de Operações sem fluxo de execução | Operações com múltiplas Operações simultâneas | Modelagem do processo (não nova superfície) |
| A-05 | Modo degradado da IA não especificado | Desenvolvimento da IA em todas as superfícies | Declaração formal: motor de regras vs. IA por feature |
| A-06 | Hierarquia de urgência no Meu Dia implícita | UX de S-01 | Decisão formal de produto |

---

### ◆ Melhorias desejáveis — não bloqueiam MVP, importante para escala

| # | Achado | Quando se torna crítico |
|---|---|---|
| A-07 | Biblioteca sem busca | 50+ documentos |
| A-08 | Entrega nativo vs. referenciado não distinguido | UX de S-07 (após resolução de A-01) |
| A-09 | Livro do Show sem revisão periódica | Operações de longa duração (2+ anos) |
| A-10 | Sem bulk import de membros | 100+ membros |

---

### ✅ Definitivamente encerrado — pode iniciar UX imediatamente

| Superfície / Entidade | Documentação | Confiança |
|---|---|---|
| S-04 Escala | Mockup completo + comportamento + ciclo de planejamento | 🟢 Alta |
| S-06 Solicitações | Mockup completo + comportamento + ciclo de planejamento | 🟢 Alta |
| S-08 Avisos | Ciclo de Comunicação (1400 linhas) + definição oficial | 🟢 Alta |
| S-11 Histórico | Ciclo de Comunicação (1400 linhas) + definição oficial | 🟢 Alta |
| S-05 Livro do Dia | Ciclo de Comunicação + definição oficial | 🟢 Alta |
| S-13 Livro do Show | 3 documentos + 1127 linhas de wireframes | 🟢 Alta |
| S-12 Agenda | Fundação completa + 5 tipos + ciclo de vida | 🟢 Alta |
| S-14 Biblioteca | Fundação completa + governança + casos limite | 🟢 Alta |
| S-10 IA | Ecossistema completo (3 contextos + 10 decisões) | 🟢 Alta |
| S-03 Painel de Saúde | Governança (4 estados + limiares configuráveis) | 🟢 Alta |
| S-15 Equipes | Governança completa + ciclo de vida | 🟢 Alta |
| S-16 Operações | Governança completa + 4 estados | 🟢 Alta |
| S-17 Administração | Governança completa + delegações | 🟢 Alta |
| MO (entidade) | 986 linhas dedicadas + integração em todos os ciclos | 🟢 Alta |
| S-01 Meu Dia | Wireframe (963 linhas) + definição completa | 🟡 Alta com ressalva (A-06) |
| S-02 Painel Operacional | Wireframe + definição completa | 🟡 Alta com ressalva (A-05) |

---

## VEREDITO FINAL

### 🟡 Arquitetura funcionalmente sólida — dois ajustes bloqueantes antes de iniciar UX nas superfícies afetadas

A arquitetura funcional do MyASA 2.0 é **coerente, completa em sua estrutura central, e não tem contradições sistêmicas**. Os três pilares filosóficos originais — "O que mudou?" / "O que preciso fazer?" / "A operação está saudável?" — respondem com precisão e sem ambiguidade estrutural.

**O que está verdadeiramente encerrado:** 16 das 17 superfícies têm representação formal. O ciclo operacional completo (Solicitação → Escala → Livro do Dia → Avisos → Meu Dia → Histórico) é consistente. A entidade MO é robusta. A governança define a estrutura que o núcleo operacional precisa.

**O que precisa ser resolvido antes de iniciar UX:**
1. **A-01** — decidir qual S-07 vai para o MVP (2 modelos conflitantes)
2. **A-02** — modelar S-09 Mensagens comportamentalmente

**O que precisa ser resolvido antes de iniciar desenvolvimento:**
3. **A-03** — especificar infraestrutura de Notificação
4. **A-05** — declarar formalmente o que é motor de regras vs. IA por feature

---

### Resposta à pergunta final

**"Se eu fosse iniciar UX, wireframes, mockups e desenvolvimento amanhã, eu me sentiria seguro para fazê-lo?"**

**Para S-04, S-06, S-08, S-11, S-05, S-13, S-12, S-14, S-10, S-03, S-15, S-16, S-17, S-01, S-02:**
**Sim. Com confiança.** A fundação é sólida, as decisões formais estão tomadas, as relações são consistentes.

**Para S-07:**
**Não ainda.** A divergência conceitual precisa ser resolvida antes. É uma decisão de produto de 30 minutos — mas sem ela, o designer vai criar algo que contradiz a fundação comportamental ou a definição original.

**Para S-09:**
**Não ainda.** A superfície não foi modelada comportamentalmente. Iniciar UX sem isso é iniciar sem fundação.

**Para o desenvolvimento como um todo:**
**Sim, com duas ressalvas técnicas:** a especificação de Notificação (A-03) e a declaração formal de modo IA vs. motor de regras (A-05) precisam existir antes de qualquer sprint de engenharia nas features afetadas.

---

*Auditoria realizada em 18/06/2026 — MyASA 2.0*
*121 decisões formais auditadas · 28 documentos consultados · 2 bloqueantes · 4 ajustes importantes · 5 melhorias desejáveis*
