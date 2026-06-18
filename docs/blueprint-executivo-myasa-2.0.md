# MyASA 2.0 — Blueprint Executivo Oficial

> **Versão:** 18/06/2026
> **Base:** 17 superfícies · 131 decisões formais · Arquitetura funcional congelada
> **Propósito:** documento único de referência — qualquer pessoa nova ao projeto deve entender o produto em menos de 10 minutos com a Parte 9 e mergulhar em qualquer área com as partes 1–8
> **Status:** 🟢 Pronto para Construção

---

## PARTE 1 — VISÃO GERAL DO PRODUTO

---

### O que é o MyASA?

**MyASA é uma plataforma operacional para produções artísticas.**

Ele existe para resolver um problema específico: equipes de artes cênicas e produções ao vivo operam em alta complexidade — shows diários, papéis múltiplos por membro, escalas que mudam em horas, restrições pessoais, substituições de última hora — e fazem isso pelo WhatsApp, planilhas e comunicação verbal.

O resultado é previsível: membros chegam no horário errado, no personagem errado, sem saber que houve uma mudança. Supervisores gerenciam por instinto, não por visibilidade. Decisões não têm registro. Responsabilidades se diluem.

O MyASA substitui isso com um sistema onde **a operação inteira acontece em um único lugar, com rastreabilidade completa e responsabilidade clara.**

---

### O problema que resolve

| Dor real | Como o MyASA resolve |
|---|---|
| "Não sabia que meu personagem mudou" | S-01 Meu Dia destaca alterações com prioridade visual — o Membro vê o que mudou antes de tudo |
| "O Supervisor pediu no WhatsApp, não tem como provar" | S-06 Solicitações — toda decisão tem registro, motivo, timestamp e autor |
| "Publiquei a Escala, mas não sei quem recebeu" | Rastreamento de confirmação: o sistema sabe quem confirmou e quem não confirmou |
| "O show está em 2 horas e tem uma posição crítica em aberto" | S-02 Painel Operacional — o Supervisor vê exceções priorizadas por impacto e tempo |
| "Não tenho como saber por que a folga foi negada" | S-06 — motivo de negação é obrigatório. Botão bloqueado sem preenchimento. |
| "A Escala mudou mas o Livro do Dia não foi atualizado" | Propagação automática via MO — toda mudança na Escala flags o Livro do Dia como desatualizado |

---

### Missão

> **Eliminar a incerteza operacional nas produções artísticas.** Cada Membro sabe exatamente o que precisa fazer. Cada Supervisor tem visibilidade real do que está acontecendo. Cada decisão tem registro.

---

### Filosofia operacional

O MyASA opera sob princípios que moldam cada decisão de produto:

**O sistema informa. O humano decide.**
A IA e o motor de cobertura nunca tomam decisões operacionais sozinhos. Toda proposta automatizada exige confirmação humana explícita antes de ser executada.

**Uma única fonte de verdade.**
A Escala publicada é a realidade oficial. O Livro do Dia é o detalhamento oficial do show. Não existe versão paralela em outro canal.

**Rastreabilidade não é opcional.**
Toda mudança operacional gera uma Mudança Operacional (MO) com autor, timestamp e contexto. Nenhuma alteração acontece silenciosamente.

**O Membro não trabalha mais do que precisa para saber o que fazer.**
S-01 Meu Dia responde "O que preciso fazer hoje e mudou alguma coisa?" em segundos. O produto não exige que o Membro procure informação — ele apresenta.

**IA potencializa, não substitui.**
O Supervisor que usa IA toma decisões mais rápidas. O Supervisor que não usa toma as mesmas decisões. O produto funciona completamente sem IA — a IA é aceleração, não dependência.

---

## PARTE 2 — OS 3 PERFIS

---

### Membro

**Principal pergunta respondida pelo produto:**
*"O que preciso fazer hoje — e mudou alguma coisa desde a última vez que verifiquei?"*

**Responsabilidades:**
- Executar as atividades conforme a Escala publicada
- Confirmar recebimento de mudanças que o afetam
- Fazer Solicitações formais (Folga, Restrição, Troca) quando necessário
- Concluir Entregas (conteúdo obrigatório) dentro do prazo
- Comunicar dúvidas e alinhamentos via Mensagens contextuais

**Superfícies utilizadas:**
| Superfície | Frequência | Papel |
|---|---|---|
| S-01 Meu Dia | Múltiplas vezes ao dia | Consultar alocação, confirmar mudanças |
| S-06 Solicitações | Quando necessário | Criar pedidos formais |
| S-05 Livro do Dia | Antes de cada show | Consultar papel específico no show |
| S-12 Agenda | Semanal | Visualizar calendário de shows |
| S-07 Entregas | Quando atribuída | Consumir e confirmar conteúdo obrigatório |
| S-09 Mensagens | Quando necessário | Esclarecer dúvidas com Supervisor |
| S-08 Avisos | Quando recebido | Ler e confirmar comunicados oficiais |

**Valor entregue:**
O Membro nunca mais chega num show sem saber que algo mudou. O aplicativo mobile é a fonte de verdade sobre o que ele precisa fazer — mais confiável do que o WhatsApp, mais rápido do que ligar para o Supervisor.

---

### Supervisor

**Principal pergunta respondida pelo produto:**
*"A operação de hoje está protegida? Existe alguma exceção que precisa da minha atenção agora?"*

**Responsabilidades:**
- Criar e publicar a Escala (alocação de quem faz o quê em cada show)
- Gerar e publicar o Livro do Dia (documento operacional do show)
- Analisar e decidir Solicitações dos Membros
- Gerenciar substituições (planejadas e emergenciais)
- Enviar Avisos oficiais e rastrear confirmações
- Atribuir Entregas (conteúdo obrigatório) ao grupo
- Coordenar com outros Supervisores e com o Admin via Mensagens

**Superfícies utilizadas:**
| Superfície | Frequência | Papel |
|---|---|---|
| S-02 Painel Operacional | Múltiplas vezes ao dia | Triagem de exceções e status geral |
| S-04 Escala | Diária / véspera | Construção, edição, publicação |
| S-05 Livro do Dia | Antes de cada show | Geração, revisão, publicação |
| S-06 Solicitações | Contínuo | Análise e decisão de pedidos |
| S-08 Avisos | Quando necessário | Comunicação oficial ao grupo |
| S-07 Entregas | Quando necessário | Atribuição de conteúdo obrigatório |
| S-09 Mensagens | Contínuo | Coordenação contextual |
| S-11 Histórico | Investigação | Auditoria de eventos passados |

**Valor entregue:**
O Supervisor deixa de gerenciar pelo instinto e pelo WhatsApp. O Painel Operacional substitui a sensação de "algo vai dar errado e eu não sei o quê" por uma visão clara de exceções priorizadas por impacto. Cada decisão tem contexto (análise de impacto automática) antes de ser tomada.

---

### Admin

**Principal pergunta respondida pelo produto:**
*"O ecossistema está saudável? Existe algum padrão ou Operação que exige minha intervenção?"*

**Responsabilidades:**
- Configurar e manter a estrutura organizacional (Operações, Grupos, Membros, Papéis)
- Criar e versionar os Livros de Show (templates de espetáculos)
- Gerenciar a Agenda de shows e eventos
- Monitorar saúde organizacional de todas as Operações
- Garantir que documentos da Biblioteca têm responsável e estão em dia
- Escalar para Admin situações que extrapolam o escopo do Supervisor
- Enviar Avisos de escopo organizacional (multi-Operação)

**Superfícies utilizadas:**
| Superfície | Frequência | Papel |
|---|---|---|
| S-03 Painel de Saúde | Diária/semanal | Monitoramento de todas as Operações |
| S-17 Administração | Setup + manutenção | Perfis, permissões, delegações |
| S-15 Equipes | Setup + ajustes | Estrutura de grupos operacionais |
| S-16 Operações | Setup + gestão | Configuração de produções |
| S-13 Livro do Show | Criação / versionamento | Template de cada espetáculo |
| S-12 Agenda | Gestão contínua | Calendário organizacional |
| S-14 Biblioteca | Gestão | Repositório de conhecimento |
| S-11 Histórico | Investigação | Auditoria de todas as Operações |

**Valor entregue:**
O Admin deixa de ser informado de problemas quando já é tarde. O Painel de Saúde mostra tendências antes que virem crises. A estrutura organizacional vive no sistema — não na cabeça de ninguém.

---

## PARTE 3 — AS 17 SUPERFÍCIES

---

### SUPERFÍCIES PRIMÁRIAS — uso diário, definem a experiência central

| # | Nome | Propósito | Problema resolvido | Perfil principal | Dependências |
|---|---|---|---|---|---|
| **S-01** | **Meu Dia** | Responder "O que faço hoje e mudou alguma coisa?" | Membros chegam ao show sem saber de mudanças | Membro | S-04 Escala, S-05 Livro do Dia |
| **S-02** | **Painel Operacional** | Triagem de exceções priorizadas por impacto | Supervisor não tem visão do que precisa de atenção agora | Supervisor | S-04 Escala, S-06 Solicitações |
| **S-03** | **Painel de Saúde** | Saúde organizacional e tendências de todas as Operações | Admin descobre problemas tarde demais | Admin | Todos os dados P0 + P1 |
| **S-04** | **Escala** | Representação oficial de quem faz o quê e quando | Alocação informal, sem rastreamento | Supervisor | S-12 Agenda, S-13 Livro do Show, S-15 Equipes |
| **S-05** | **Livro do Dia** | Documento operacional detalhado de um show específico | Show acontece sem documento formal definindo posições | Supervisor / Membro | S-04 Escala, S-13 Livro do Show |
| **S-06** | **Solicitações** | Canal formal de pedidos Membro → Supervisor com análise de impacto | Pedidos pelo WhatsApp, sem rastreamento, sem motivo formal | Membro + Supervisor | S-04 Escala |

---

### SUPERFÍCIES SECUNDÁRIAS — uso frequente, suportam as jornadas principais

| # | Nome | Propósito | Problema resolvido | Perfil principal | Dependências |
|---|---|---|---|---|---|
| **S-07** | **Entregas** | Atribuição e rastreamento de conteúdo obrigatório | Conteúdo crítico distribuído sem confirmação formal de recebimento | Supervisor / Membro | S-01 Meu Dia, S-15 Equipes |
| **S-08** | **Avisos** | Comunicação oficial unidirecional com rastreamento de leitura | Comunicados críticos perdem-se no WhatsApp sem confirmação | Supervisor / Admin | S-04 Escala, S-05 Livro do Dia |
| **S-09** | **Mensagens** | Esclarecimento e coordenação contextual (não substitui Avisos) | Dúvidas operacionais saem do sistema para o WhatsApp | Membro / Supervisor | S-01, S-06, S-07 |
| **S-10** | **IA** | Inteligência embarcada nos 3 contextos (Membro, Supervisor, Admin) | Decisões tomadas sem contexto ou análise | Todos | Todos os dados do sistema |
| **S-11** | **Histórico** | Narrativa auditável de todos os eventos agrupados por MO | Decisões passadas sem evidência formal, conflitos sem resolução | Admin / Supervisor | Todos os events do sistema |

---

### SUPERFÍCIES DE SUPORTE — infraestrutura operacional e organizacional

| # | Nome | Propósito | Problema resolvido | Perfil principal | Dependências |
|---|---|---|---|---|---|
| **S-12** | **Agenda** | Calendário oficial de shows, ensaios e eventos | Shows não têm existência formal antes do dia | Admin | S-16 Operações, S-13 Livro do Show |
| **S-13** | **Livro do Show** | Template estrutural de cada espetáculo (papéis, blocos, cobertura mínima) | Cada show recriado do zero, sem padrão formal | Admin | S-16 Operações |
| **S-14** | **Biblioteca** | Repositório de conhecimento organizacional com responsável e ciclo de revisão | Conhecimento operacional na cabeça das pessoas, não documentado | Admin / Supervisor | S-16 Operações |
| **S-15** | **Equipes** | Estrutura de Grupos Operacionais com membros e Supervisores | Organograma informal, responsabilidades diluídas | Admin | S-17 Administração |
| **S-16** | **Operações** | Escopo de uma produção (show, temporada, evento) | Operações sem configuração formal, sem responsável | Admin | S-15 Equipes |
| **S-17** | **Administração** | Perfis, papéis, permissões e delegações | Acesso sem controle, delegações sem registro formal | Admin | — (fundação) |

---

### Por que não há mais superfícies

**Folgas** — não são superfície. São um tipo dentro de S-06 Solicitações.
**Restrições** — não são superfície. São atributo de membro visível como contexto em S-04 e S-05.
**Central de Notificações** — não é superfície. É infraestrutura de entrega que leva o usuário para uma superfície.
**Inbox Unificado** — não é necessário. S-09 Mensagens + S-06 Solicitações + S-07 Entregas com estados visíveis cobrem o caso de uso.

---

## PARTE 4 — CICLOS PRINCIPAIS

---

### Ciclo de Planejamento Operacional

O ciclo que define quem faz o quê em cada show.

**Início:** Admin cria Livro do Show (template do espetáculo) e registra shows na Agenda.

**Meio:**
1. Supervisor abre a Escala para o período (semana ou show)
2. Motor de cobertura classifica candidatos disponíveis por 3 camadas: sem restrição ativa → sem folga aprovada → sem conflito de horário
3. Supervisor aloca membros, resolve posições Em Aberto, verifica cascatas
4. Supervisor publica a Escala (confirmação explícita se há alertas)
5. Membros afetados recebem notificação push e confirmam mudança
6. Supervisor gera proposta de Livro do Dia a partir de Livro do Show + Escala
7. Supervisor revisa posições pendentes e publica o Livro do Dia
8. Toda publicação com mudança gera automaticamente uma MO

**Fim:** Escala publicada + Livro do Dia publicado = operação formalmente registrada. Membro abre o Meu Dia e vê o que precisa fazer.

**Republica quando:** qualquer mudança em posição publicada exige republicação explícita. O Livro do Dia não pode ser alterado silenciosamente.

---

### Ciclo de Solicitações

O ciclo que formaliza pedidos de Membros e propaga as consequências.

**Início:** Membro cria Solicitação no aplicativo mobile. 7 tipos: Folga, Restrição, Troca de Folga, Chegada Tardia, Saída Antecipada, Ajuste de Escala, Excepcional.

**Meio:**
1. Sistema calcula impacto automático: quais posições ficam descobertas, qual é a cobertura disponível
2. Supervisor vê análise de impacto na tela de decisão (não decide no escuro)
3. Supervisor decide: Aprovar / Negar (motivo obrigatório) / Proposta Alternativa
4. Se Proposta Alternativa: Membro aceita ou recusa com prazo definido
5. Decisão gera MO automaticamente
6. MO propaga para Escala (posição flagged como descoberta se aprovada)
7. Livro do Dia é flagged como desatualizado se a data afetada já tem Livro publicado
8. Membro recebe notificação push da decisão

**Fim:** decisão registrada com motivo, timestamp e impacto. Escala reflete a realidade. Membro está ciente pelo Meu Dia.

**Regra crítica:** Solicitações são ordenadas por data de impacto, não por data de criação. A folga para amanhã é mais urgente que a de próxima semana, independente de quando foi criada.

---

### Ciclo de Comunicação Operacional

O ciclo que garante que informações críticas chegam e são confirmadas.

**Início:** Supervisor ou Admin tem uma informação que precisa chegar formalmente ao grupo.

**Tipos de comunicação:**

| Canal | Quando usar | Rastreamento |
|---|---|---|
| **Aviso** | Comunicação oficial, mudança operacional, cancelamento de show | Confirmação de leitura por destinatário |
| **Mensagem** | Esclarecimento contextual, coordenação informal | Sem confirmação formal — é comunicação, não instrução |
| **Entrega** | Conteúdo obrigatório que exige conclusão formal | Rastreamento RECEBIDA → VISUALIZADA → CONCLUÍDA |

**Meio (Aviso):**
1. Supervisor cria Aviso com nível de urgência (Informativo / Importante / Crítico)
2. Aviso enviado via push notification (nível de prioridade correspondente)
3. Membro recebe notificação, abre o Aviso no app e confirma leitura
4. Supervisor vê rastreamento em tempo real: confirmados × pendentes
5. Se membro não confirmou próximo ao horário da atividade → alerta automático ao Supervisor
6. Supervisor pode renotificar manualmente quem não confirmou

**Aviso automático:** cancelamento de show via Agenda → Aviso Crítico gerado automaticamente para todos os membros alocados.

**Fim:** todo Aviso tem registro de quem recebeu, quem confirmou e quando. Nenhum "mas eu não sabia" sem evidência formal.

---

### Ciclo de Entregas

O ciclo de compliance de conteúdo obrigatório.

**Início:** Supervisor ou Admin precisa garantir que todos os membros consumiram um conteúdo específico.

**Meio:**
1. Supervisor cria Entrega: escolhe tipo (Leitura / Vídeo / Atualização Operacional / Checklist), atribui destinatários, define prazo
2. Entrega publicada (RASCUNHO → PUBLICADA)
3. Destinatários recebem notificação push
4. Estado por membro: PUBLICADA → RECEBIDA → VISUALIZADA → CONCLUÍDA
5. Passado o prazo sem conclusão: estado ATRASADA + alerta ao Supervisor
6. Passado o prazo máximo: estado EXPIRADA + registro permanente (imutável)
7. Supervisor monitora estados no dashboard de Entregas

**Fim:** registro permanente de quem concluiu, quem atrasou, quem expirou. O estado EXPIRADA não desaparece — é o registro de que o membro não cumpriu.

**Limite explícito:** Entrega não é avaliação. É binária: CONCLUÍDA ou não. O Supervisor não dá nota — registra conclusão.

---

### Ciclo de Agenda

O ciclo que dá existência formal aos shows.

**Início:** Admin cria evento na Agenda (5 tipos MVP: Show, Ensaio, Reunião, Workshop, Outro).

**Estados do evento:**
```
RASCUNHO → CONFIRMADO → ALTERADO → CANCELADO → REALIZADO
```

**Propagações automáticas:**
- CONFIRMADO → habilita criação de Livro do Dia para essa data
- ALTERADO → Livros do Dia existentes são flagged como desatualizados
- CANCELADO → Aviso Crítico gerado automaticamente para todos os membros alocados + Escala recalculada

**Fim:** shows têm existência formal antes de acontecer. O sistema sabe o que vem por aí.

---

### Ciclo de Governança

O ciclo que mantém a organização saudável ao longo do tempo.

**Início:** Admin configura a estrutura (S-17 → S-15 → S-16 → S-13 → Agenda) no setup obrigatório.

**Monitoramento contínuo via S-03 Painel de Saúde:**
- 4 estados por Operação: Saudável / Atenção / Crítico / Sem Dados
- Limiares configuráveis pelo Admin por indicador
- Indicadores de tendência (crescendo / estável / melhorando)
- Itens sem responsável definido

**Sinais de alerta:**
- Operação com % de posições cobertas abaixo do limiar configurado
- Solicitações com tempo médio de resposta acima do limiar
- Documentos da Biblioteca vencidos sem revisão
- Grupos sem Supervisor ativo
- Delegações expirando sem renovação

**Fim:** Admin intervém antes de crises, não depois. A governança é proativa, não reativa.

---

## PARTE 5 — INTELIGÊNCIA ARTIFICIAL

---

### Arquitetura de IA

A IA do MyASA opera em **3 contextos distintos com 3 personas distintas**. O contexto define o escopo, os dados disponíveis e o tipo de resposta esperada. Uma mesma pergunta feita por um Membro e por um Admin gera respostas diferentes — não por capricho, mas porque os dados acessíveis e o enquadramento correto são diferentes.

**Regra universal:** a IA nunca toma decisões operacionais. Propõe, contextualiza, resume, prioriza — mas toda ação que modifica dados exige confirmação humana explícita. O fluxo é sempre: Proposta IA → Confirmação Humana → Execução → Opção de Desfazer.

---

### IA do Membro — Intérprete Pessoal

**Acesso aos dados:** apenas os dados do próprio Membro (Escala pessoal, Solicitações, Entregas, Histórico individual)

**Persona:** simples, pessoal, direta. Fala em primeira pessoa com o Membro.

**Onde atua:** primariamente no S-01 Meu Dia

**O que faz:**
- Resume o dia em linguagem natural ("Hoje você faz Mercutio às 15h e Romeu às 20h — o personagem das 15h mudou ontem")
- Destaca mudanças e explica o contexto ("Seu personagem mudou porque João pediu folga e você foi o candidato disponível mais próximo")
- Responde perguntas sobre o dia sem navegar para outras superfícies ("O que mudou no show de hoje?")
- Lembra de prazos próximos de Entregas

**O que não faz:**
- Não acessa dados de outros membros
- Não toma decisões pela ASA
- Não cria Solicitações automaticamente

---

### IA do Supervisor — Copiloto Operacional

**Acesso aos dados:** todos os dados do Grupo Operacional sob sua responsabilidade

**Persona:** precisa, operacional, orientada a ação. Fala como um assessor experiente que conhece o grupo.

**Onde atua:** primariamente no S-02 Painel Operacional e S-04 Escala

**O que faz:**
- Prioriza automaticamente exceções ao abrir o Painel ("Resolva essa primeiro — ela começa em 45 minutos e não tem cobertura")
- Propõe candidatos de cobertura com justificativa operacional
- Simula cascatas antes de confirmar substituição ("Se você mover o João, o Pedro fica descoberto em Romeu")
- Narra o que aconteceu enquanto o Supervisor estava offline
- Responde perguntas sobre o grupo ("Quem tem restrição ativa para o show de amanhã?")
- Gera proposta de Livro do Dia automaticamente

**O que não faz:**
- Não publica Escala ou Livro do Dia — só propõe
- Não decide Solicitações
- Não envia Avisos automaticamente (cancelamento de show gera Aviso, mas Supervisor confirma antes de enviar)

---

### IA do Admin — Analista Organizacional

**Acesso aos dados:** dados agregados de todas as Operações

**Persona:** analítica, estratégica, orientada a padrões. Fala como um diretor de operações.

**Onde atua:** primariamente no S-03 Painel de Saúde e S-11 Histórico

**O que faz:**
- Resume o estado de cada Operação em linguagem narrativa ("O Snowland está com tendência de piora — 3 semanas consecutivas com posições críticas em aberto na sexta")
- Detecta padrões antes que o Admin precise perguntar
- Responde perguntas analíticas com contexto histórico ("Qual foi a tendência de folgas no último mês?")
- Identifica Operações que precisam de atenção sem que o Admin navegue manualmente

**O que não faz:**
- Não altera estrutura organizacional
- Não interfere em Escalas ou decisões operacionais

---

### Limites formais da IA

| Limite | Justificativa |
|---|---|
| IA nunca age sem confirmação humana | Decisões operacionais têm consequências reais. Automação sem revisão é risco. |
| IA nunca substitui um Supervisor | O produto funciona sem IA. IA potencializa, não habilita. |
| IA não conversa em nome de outro usuário | Mensagem enviada por IA em nome do Supervisor seria desonesta. Não existe. |
| IA não publica nada | Publicação de Escala, Livro do Dia, Avisos — tudo exige ação humana explícita. |
| Ações da IA são identificadas no Histórico | O registro distingue "ação humana" de "proposta de IA aceita pelo humano". |
| IA não tem acesso a dados fora do escopo do perfil | A IA do Membro não vê dados de outros Membros. A IA do Supervisor não vê outras Operações. |

---

### Motor Determinístico vs. LLM

**No MVP Piloto:** motor determinístico (regras explícitas, previsível, sem dependência externa).

**No MVP, o motor determinístico cobre:**
- Classificação de candidatos por 3 camadas (sem restrição → sem folga → sem conflito)
- Detecção de conflitos por sobreposição de horários
- Cálculo de cascata por grafo de dependências
- Análise de impacto de Solicitação (cobertura mínima por data)
- Priorização de exceções no Painel (urgência = tempo até início × peso de criticidade)
- MO automática em cada mudança de estado

**Na Fase 4:** LLM introduzido para linguagem natural, resumos, análise de padrões e chat livre.

---

## PARTE 6 — ARQUITETURA DE DADOS

---

### Entidades centrais e relações

```
Organização
    └── Operação (1..n)
            ├── Grupos Operacionais (1..n)
            │       └── Membros (1..n)
            │               ├── Perfil (Admin / Supervisor A / Supervisor B / Membro)
            │               ├── Restrições (0..n) [tipo, período]
            │               └── Delegações (0..n) [temporárias]
            │
            ├── Livros do Show (1..n) ── template do espetáculo
            │       ├── Blocos (1..n)
            │       ├── Papéis (1..n) [com cobertura mínima]
            │       └── Versões (histórico de versionamento)
            │
            ├── Agenda ── calendário da Operação
            │       └── Eventos (0..n) [Show, Ensaio, Reunião, Workshop, Outro]
            │               └── Livro do Dia (0..1 por evento por data)
            │                       ├── Posições (1..n) [Coberta / Em Risco / Em Aberto]
            │                       └── Versões (histórico de republicações)
            │
            ├── Escala ── alocação por período
            │       └── Alocações (0..n) [Membro × Posição × Data]
            │
            ├── Solicitações (0..n) [por Membro]
            │       └── Decisão (0..1) [por Supervisor]
            │
            ├── Mudanças Operacionais / MOs (0..n) [geradas automaticamente]
            │       ├── Tipo [substituição, aprovação de folga, cancelamento, etc.]
            │       ├── Entidades afetadas [Membros, posições, datas]
            │       └── Registros no Histórico
            │
            ├── Avisos (0..n)
            │       └── Confirmações (0..n) [por Membro]
            │
            ├── Entregas (0..n)
            │       └── Estados por Membro [PUBLICADA → RECEBIDA → VISUALIZADA → CONCLUÍDA]
            │
            ├── Mensagens (0..n)
            │       ├── Contextuais [vinculadas a uma entidade: Solicitação, Aviso, Entrega, MO]
            │       └── Livres [Membro ↔ Supervisor · Supervisor ↔ Supervisor · etc.]
            │
            ├── Biblioteca (0..n) [documentos com Responsável obrigatório]
            │       └── Documentos [Procedimento, Regra, Material de Apoio, Procedimento de Segurança, Registro]
            │
            └── Histórico (gerado automaticamente por MOs)
                    └── Eventos [agrupados por MO · author · before → after · timestamp]
```

---

### Entidade-chave: Mudança Operacional (MO)

A MO é a espinha dorsal do rastreamento. Toda mudança que afeta a operação gera uma MO automaticamente — nunca manualmente.

**O que gera MO:**
- Publicação de Escala com mudança de alocação
- Aprovação de Solicitação de Folga ou Restrição
- Substituição (planejada ou emergencial)
- Cancelamento de show via Agenda
- Republicação de Livro do Dia após mudança

**O que uma MO contém:**
- Tipo da mudança
- Quem gerou (humano ou motor de cobertura confirmado por humano)
- Entidades afetadas (membros, posições, datas)
- Estado antes e estado depois
- Timestamp
- Eventos de rastreamento (quem confirmou a mudança, quando)

**Relação com Histórico:**
O Histórico é composto de MOs. Não é um log técnico — é a narrativa operacional da produção, navegável por Membro, por data, por tipo de evento.

---

### Regras de consistência de dados

| Regra | Implementação |
|---|---|
| Escala mudou → Livro do Dia flagged DESATUALIZADO | Event-driven automático |
| Evento CANCELADO → Aviso Crítico para todos alocados | Trigger automático em Agenda |
| Solicitação aprovada → MO criada → Escala atualizada | Pipeline automático |
| Entrega EXPIRADA → registro permanente e imutável | Estado terminal, nunca deletável |
| Mensagem enviada → imutável | Sem edição, sem exclusão, sem apagamento |
| Publicação com alerta aberto → confirmação explícita obrigatória | Bloqueio de UI |
| Negação de Solicitação sem motivo → botão bloqueado | Validação de UI + backend |

---

## PARTE 7 — MVP PILOTO

---

### Configuração

**1 Operação · 1 Supervisor · 15-25 Membros · 4 semanas de shows reais**

Precedida por 1 semana de pré-piloto (setup + onboarding + teste de Escala sem show real).

---

### Classificação das superfícies no piloto

| Épico | Superfícies | Status no piloto |
|---|---|---|
| Epic 00 — Infra | Auth, DB, API, Push | 🔴 Obrigatório |
| Epic 01 — Fundação | S-17, S-15, S-16 | 🔴 Obrigatório |
| Epic 02 — Template + Calendário | S-13, S-12 | 🔴 Obrigatório |
| Epic 03 — Escala | S-04 | 🔴 Obrigatório |
| Epic 04 — Solicitações | S-06 | 🔴 Obrigatório |
| Epic 05 — Interfaces | S-01, S-02 | 🔴 Obrigatório |
| Epic 06 — Livro do Dia | S-05 (básico) | 🟡 Importante (entra semana 2) |
| Epic 07 — Avisos | S-08 | 🟡 Importante (entra semana 3) |
| Epic 08 — Histórico | S-11 (básico) | 🟡 Importante (final do piloto) |
| Epic 09-13 | S-03, S-07, S-09, S-14, S-10 | ⬜ Pós-piloto |

---

### 5 Sprints de construção (10 semanas)

| Sprint | Semanas | Objetivo | Marco |
|---|---|---|---|
| **Sprint 1** | 1–2 | O sistema existe | Admin entra e configura a organização |
| **Sprint 2** | 3–4 | O show existe | Livro do Show criado, Agenda com shows, Push configurado |
| **Sprint 3** | 5–6 | A alocação existe | **Escala publicada, Membro vê papel no app** ← primeiro valor real |
| **Sprint 4** | 7–8 | O pedido existe | Solicitação criada, decidida, Meu Dia completo |
| **Sprint 5** | 9–10 | O loop está completo | Painel Operacional, ciclo E2E testado, pronto para piloto |

---

### Decisões técnicas encerradas

| Decisão | Resolução |
|---|---|
| **A-03 — Notificação** | Push-only no piloto. In-app banner web entra na Fase 2. |
| **A-05 — Motor** | Motor determinístico no piloto. LLM introduzido na Fase 4. |
| **S-07 — Modelo** | Compliance de Conteúdo (binário). Gestão de tarefas com avaliação é pós-MVP. |

---

### Critérios Go / No-Go (semana 4 do piloto)

**GO (expandir):** M1 ≥ 90% de Escalas publicadas · M2 ≥ 80% de confirmações de mudança · M3 ≥ 85% de Solicitações no produto · M4 = 100% de negações com motivo · M5 < 24h de tempo médio de decisão · zero bugs críticos · NPS Supervisor ≥ 40

**AJUSTAR (corrigir antes de expandir):** 3+ métricas atingidas mas problemas específicos de UX ou fluxo identificados → semana adicional com correções

**NO-GO (pausar para diagnóstico):** bug crítico com perda de dados · M1 < 50% após semana 3 · dado de um membro visível para outro · Supervisor abandona o piloto

---

## PARTE 8 — PRINCÍPIOS INEGOCIÁVEIS

Os princípios abaixo não são aspirações — são restrições de design. Qualquer feature que os viole está errada, não importa o argumento funcional.

---

### 1. O sistema informa. O humano decide.
Nenhuma ação operacional é executada automaticamente sem confirmação humana explícita. Motor de cobertura propõe. IA prioriza. Supervisor confirma. Sem exceção.

### 2. Uma única fonte de verdade.
A Escala publicada é a realidade oficial de quem trabalha. O Livro do Dia publicado é o documento oficial do show. Não existe versão paralela válida em nenhum canal externo.

### 3. O Livro do Dia nunca é alterado silenciosamente.
Qualquer mudança em posição publicada exige republicação explícita. A versão anterior é preservada. O delta entre versões é visível.

### 4. Toda decisão tem registro.
Toda aprovação, negação e proposta alternativa de Solicitação tem autor, timestamp, motivo (obrigatório em negações) e estado anterior. Histórico é imutável.

### 5. Rastreabilidade não é opcional.
Toda MO é registrada automaticamente. Toda confirmação de leitura é rastreada. O sistema sempre sabe quem sabe o quê.

### 6. Negação sem motivo não existe.
O botão de negar Solicitação é bloqueado enquanto o campo de motivo estiver vazio. Backend valida além da UI.

### 7. Mensagem não pode ser desfeita.
Mensagem enviada é imutável — sem edição, sem exclusão, sem apagamento. Proteção do registro operacional.

### 8. Entrega expirada é permanente.
Estado EXPIRADA não desaparece. O registro de que o Membro não cumpriu é imutável.

### 9. O Membro nunca vê dados de outros Membros.
S-01 Meu Dia é estritamente individual. A IA do Membro acessa apenas os dados do próprio Membro.

### 10. Escopo do Supervisor é o seu Grupo.
Supervisor vê apenas os dados do seu Grupo Operacional. Não há acesso a dados de outros Grupos sem delegação formal do Admin.

### 11. IA nunca age em nome de alguém.
Aviso nunca é enviado em nome do Supervisor pela IA. Mensagem nunca é enviada pela IA como se fosse de um humano. A IA é identificada em toda ação que gera no Histórico.

### 12. Admin não pode publicar como Supervisor.
Admin tem visibilidade de tudo. Admin não tem autoridade operacional direta sobre o escopo de um Supervisor sem delegação formal.

### 13. A operação funciona sem IA.
O produto tem comportamento completo e previsível com o motor determinístico. IA indisponível não bloqueia nenhuma operação.

### 14. Setup obrigatório não tem atalho.
A sequência S-17 → S-15 → S-16 → S-13 → Agenda é obrigatória. A plataforma não permite operar sem estrutura organizacional formal mínima.

### 15. Notificação push é gatilho, não comunicação.
A notificação push leva o usuário para o lugar certo no app. A confirmação, leitura e ação acontecem dentro do produto — não na notificação.

---

## PARTE 9 — RESUMO EXECUTIVO (1 PÁGINA)

---

**MyASA 2.0** é uma plataforma operacional para produções artísticas. Substitui WhatsApp, planilhas e comunicação verbal por um sistema com rastreabilidade completa e responsabilidade clara.

---

**O problema central:** equipes de artes cênicas operam em alta complexidade — shows diários, múltiplos papéis, substituições de última hora — e gerenciam tudo informalmente. Membros chegam ao show sem saber de mudanças. Decisões não têm registro. Supervisores gerenciam por instinto.

---

**Os 3 usuários e suas perguntas diárias:**

> **Membro:** *"O que faço hoje e mudou alguma coisa?"* → respondida por S-01 Meu Dia
> **Supervisor:** *"A operação está protegida? Tem exceção que precisa de mim?"* → respondida por S-02 Painel Operacional
> **Admin:** *"O ecossistema está saudável? Algum padrão preocupante?"* → respondida por S-03 Painel de Saúde

---

**O loop operacional central (5 passos):**

```
1. Admin configura show → S-13 Livro do Show + S-12 Agenda
2. Supervisor aloca e publica → S-04 Escala
3. Membro pede mudança → S-06 Solicitações
4. Supervisor decide com impacto automático → Aprovação propaga via MO
5. Membro vê resultado → S-01 Meu Dia atualizado + notificação push
```

---

**O que o produto entrega:**
- Membro nunca mais chega ao show sem saber de mudanças
- Toda Solicitação tem registro, motivo e rastreabilidade
- Supervisor vê exceções priorizadas por impacto — não por ordem de chegada
- Toda mudança operacional propaga automaticamente para todas as superfícies afetadas
- Nenhuma decisão desaparece — o Histórico é permanente e auditável

---

**Arquitetura em números:**
17 superfícies · 14 épicos · 131 decisões formais · 131 features mapeadas

---

**Roadmap:**

| Fase | O que entrega | Quando |
|---|---|---|
| Fase 1 — Fundação | Loop operacional completo (MVP) | 10 semanas |
| Fase 2 — Operação | Livro do Dia + Avisos + Histórico + Painel de Saúde | +6 semanas |
| Fase 3 — Comunicação | Entregas + Mensagens + Biblioteca | +6 semanas |
| Fase 4 — Inteligência | IA (LLM) nos 3 contextos | +10 semanas |
| Fases 5–6 | Governança em escala + Integrações externas | Futuro |

---

**Status atual:** arquitetura funcional congelada. Backlog pronto. Sprints definidos. **A equipe pode começar amanhã.**

---

## PARTE 10 — VEREDITO

---

### Uma equipe nova conseguiria construir o MyASA apenas com este documento?

**Resposta curta:** não apenas com este documento — mas com este documento mais os documentos referenciados, sim.

**O que este Blueprint cobre:**
- Definição completa do produto e sua filosofia
- Os 3 perfis com responsabilidades e superfícies
- As 17 superfícies com propósito e dependências
- Os 5 ciclos operacionais principais com início, meio e fim
- A arquitetura de IA com limites explícitos
- O modelo de dados com entidades e relações
- O plano do piloto com sprints e critérios de sucesso
- Os 15 princípios inegociáveis de produto

**O que requer leitura dos documentos de suporte:**
- Comportamento detalhado de cada superfície → `docs/ux-superficies-myasa-2.0.md`
- Ciclos operacionais completos → `docs/ciclo-planejamento-operacional-myasa-2.0.md` e `docs/ciclo-comunicacao-operacional-myasa-2.0.md`
- Entidade MO completa → `docs/mudanca-operacional-myasa-2.0.md`
- Fundação de S-09 Mensagens → `docs/fundacao-s09-mensagens-myasa-2.0.md`
- Backlog detalhado com tarefas → `docs/backlog-mestre-myasa-2.0.md`
- Plano de sprints com critérios de aceite → `docs/plano-mvp-piloto-myasa-2.0.md`

---

## 🟢 Sim — com os documentos de suporte listados acima

O Blueprint Executivo mais os documentos referenciados fornecem contexto suficiente para:
- Um desenvolvedor entender o que construir e em que ordem
- Um designer entender os fluxos e os princípios de UX
- Um Product Manager entender as prioridades e o roadmap
- Um stakeholder entender o produto, o problema e o valor

**A arquitetura do MyASA 2.0 está completa. O produto pode ser construído.**

---

### Índice de documentos de referência

| Documento | Conteúdo | Linhas |
|---|---|---|
| `blueprint-executivo-myasa-2.0.md` | **Este documento — referência consolidada** | ~700 |
| `backlog-mestre-myasa-2.0.md` | 14 épicos, 131 features, dependências, roadmap | 942 |
| `plano-mvp-piloto-myasa-2.0.md` | 5 sprints, critérios de aceite, Go/No-Go, métricas | 664 |
| `auditoria-final-arquitetura-funcional-myasa-2.0.md` | Auditoria adversarial, achados, veredito | 808 |
| `ux-superficies-myasa-2.0.md` | Mapa completo das 17 superfícies | 974 |
| `ciclo-planejamento-operacional-myasa-2.0.md` | Ciclo de Planejamento + Escala + Solicitações | 1175 |
| `ciclo-comunicacao-operacional-myasa-2.0.md` | Livro do Dia + Avisos + Histórico | 1400 |
| `mudanca-operacional-myasa-2.0.md` | Entidade MO — definição, tipos, propagação | 986 |
| `fundacao-s09-mensagens-myasa-2.0.md` | S-09 — esclarecimento e coordenação contextual | 611 |
| `governanca-organizacional-myasa-2.0.md` | S-03, S-15, S-16, S-17 | 809 |
| `ecossistema-ia-myasa-2.0.md` | IA nos 3 contextos, limites, modo degradado | 714 |
| `ciclo-entregas-s07-myasa-2.0.md` | S-07 Compliance de Conteúdo — 4 tipos, estados | 739 |
| `agenda-s12-myasa-2.0.md` | S-12 Agenda — eventos, estados, propagações | 604 |
| `biblioteca-s14-myasa-2.0.md` | S-14 Biblioteca — documentos, responsável, revisão | 697 |

---

*Blueprint Executivo Oficial produzido em 18/06/2026 — MyASA 2.0*
*17 superfícies · 131 decisões formais · 14 épicos · 1 produto pronto para ser construído*
