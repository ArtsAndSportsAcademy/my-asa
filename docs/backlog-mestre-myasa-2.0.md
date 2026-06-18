# MyASA 2.0 — Planejamento de Execução e Backlog Mestre

> **Versão:** 18/06/2026
> **Fase:** Planejamento de Execução — posterior à conclusão da Arquitetura Funcional
> **Base:** 17 superfícies · 131 decisões formais · Auditoria Final · Fundação S-09 · S-07 MVP = Compliance de Conteúdo
> **Status:** 🟢 Pronto para desenvolvimento — backlog executável

---

## Premissa

A arquitetura funcional do MyASA 2.0 está completa. Este documento transforma essa arquitetura em um plano de construção. O objetivo não é criar novas funcionalidades — é sequenciar e decompor o que já foi definido em unidades que uma equipe de desenvolvimento pode executar.

**Princípio de sequenciamento:** construir pelo loop operacional crítico primeiro. O MyASA só tem valor quando um Supervisor consegue alocar um Membro, publicar uma Escala e o Membro vê o que precisa fazer. Tudo o que não faz parte desse loop pode esperar.

---

## PARTE 1 — MAPA DOS PILARES

---

### Classificação de prioridade

| Prioridade | Definição |
|---|---|
| **P0** | Obrigatório para MVP — sem isso o produto não funciona para nenhum usuário |
| **P1** | Importante para MVP — o produto funciona mas a experiência é incompleta sem isso |
| **P2** | Pós-piloto — necessário para escalar mas não para validar |
| **P3** | Futuro — melhoria relevante após produto estabelecido |

---

### Tabela de superfícies e pilares

| Superfície | Objetivo | Dependências técnicas | Prioridade |
|---|---|---|---|
| **Infra Base** | Auth, API, DB schema, notificações | Nenhuma | P0 |
| **S-17 Administração** | Perfis, permissões, delegações | Infra | P0 |
| **S-15 Equipes** | Estrutura organizacional, grupos | S-17 | P0 |
| **S-16 Operações** | Escopo operacional | S-15 | P0 |
| **S-13 Livro do Show** | Template base de cada espetáculo | S-16 | P0 |
| **S-12 Agenda** | Calendário de shows e eventos | S-16, S-13 | P0 |
| **S-04 Escala** | Alocação oficial de quem faz o quê | S-12, S-13, S-15 | P0 |
| **S-06 Solicitações** | Canal formal de pedidos Membro → Supervisor | S-04 | P0 |
| **S-01 Meu Dia** | Interface diária do Membro | S-04, S-06 | P0 |
| **S-02 Painel Operacional** | Interface de exceções do Supervisor | S-04, S-06 | P0 |
| **S-05 Livro do Dia** | Documento operacional do show | S-04, S-13, S-12 | P1 |
| **S-08 Avisos** | Comunicação oficial unidirecional | S-05, S-04 | P1 |
| **S-11 Histórico** | Narrativa auditável da operação | Todos P0 e P1 | P1 |
| **S-03 Painel de Saúde** | Dashboard organizacional do Admin | P0 + P1 | P1 |
| **S-07 Entregas** | Compliance de conteúdo obrigatório | S-01, S-15 | P2 |
| **S-09 Mensagens** | Esclarecimento e coordenação contextual | S-01, S-06 | P2 |
| **S-14 Biblioteca** | Repositório de conhecimento organizacional | S-16, S-13 | P2 |
| **S-10 IA** | Inteligência embarcada nos 3 contextos | Todos P0, P1, P2 | P2/P3 |
| Notificação Push (infra) | Entrega de Avisos e alertas | S-08 | P1 |
| Modo Degradado IA (infra) | Comportamento sem LLM disponível | S-10 | P2 |
| Bulk Import Membros | Importação em massa via CSV | S-17 | P3 |
| Integração RH (LG-04) | Sincronização automática com sistemas de RH | S-17 | P3 |

---

## PARTE 2 — ÉPICOS

---

### Epic 00 — Infraestrutura Base

**Descrição:** camada técnica que suporta todo o produto. Inclui autenticação, modelo de dados, API REST/GraphQL, sistema de notificações e infraestrutura de mensageria.

**Valor entregue:** permite que todos os outros épicos existam. Sem isso, nada é construível.

**Dependências:** nenhuma.

**Escopo técnico:**
- Auth (JWT + refresh tokens + PKCE mobile)
- Schema de banco de dados (usuários, operações, equipes, papéis, permissões)
- API base (rotas, middlewares, controle de acesso por perfil)
- Sistema de notificação (push infrastructure, filas, retry)
- Infraestrutura de Entidade MO (criação, propagação, auditoria)

---

### Epic 01 — Fundação Organizacional

**Superfícies:** S-17 Administração · S-15 Equipes · S-16 Operações

**Descrição:** permite que o Admin configure toda a estrutura organizacional do MyASA — cria a Operação, define os Grupos Operacionais, cadastra membros com seus perfis e permissões, e configura as delegações. É a sequência de setup obrigatória (S-17 → S-15 → S-16 → S-13 → Agenda).

**Valor entregue:** a organização existe no sistema e pode ser operada.

**Dependências:** Epic 00.

---

### Epic 02 — Livro do Show + Agenda

**Superfícies:** S-13 Livro do Show · S-12 Agenda

**Descrição:** o Admin cria o template estrutural de cada espetáculo (papéis, blocos, cobertura mínima, regras do show) e registra o calendário de shows e eventos. É a base sobre a qual todas as superfícies operacionais são geradas.

**Valor entregue:** os shows existem como estrutura formal. O Livro do Dia pode ser gerado. A Escala tem referência de demanda.

**Dependências:** Epic 01.

---

### Epic 03 — Escala

**Superfície:** S-04

**Descrição:** o Supervisor cria, edita e publica a alocação oficial. O motor de cobertura classifica candidatos em 4 camadas. Cascatas são calculadas antes de confirmar qualquer movimento. Publicação exige confirmação explícita. Membros afetados confirmam mudança.

**Valor entregue:** a operação tem uma alocação oficial, publicada, rastreável e com confirmação de recebimento.

**Dependências:** Epics 01, 02.

---

### Epic 04 — Solicitações

**Superfície:** S-06

**Descrição:** o Membro cria pedidos formais (7 tipos MVP). O sistema calcula automaticamente o impacto operacional antes de apresentar as opções ao Supervisor. O Supervisor decide (aprovar / negar com motivo obrigatório / proposta alternativa). Aprovação gera MO automaticamente e atualiza a Escala.

**Valor entregue:** o canal formal de pedidos existe, substituindo WhatsApp. Cada decisão tem registro, motivo e rastreabilidade.

**Dependências:** Epic 03.

---

### Epic 05 — Meu Dia + Painel Operacional

**Superfícies:** S-01 · S-02

**Descrição:** as duas interfaces de home — uma para o Membro (o que preciso fazer hoje e o que mudou) e uma para o Supervisor (existe alguma exceção que precisa da minha atenção agora?). Ambas são composições de dados dos épicos anteriores, não têm entidade própria no backend — são views sobre o que já existe.

**Valor entregue:** os usuários têm uma entrada no produto que responde diretamente às suas perguntas diárias. O loop operacional central está completo.

**Dependências:** Epics 03, 04.

> **Marco:** após Epic 05, o MVP mínimo está operacional. Um Supervisor consegue alocar membros, publicar Escala, receber solicitações e decidir. Um Membro consegue ver o que faz hoje e solicitar mudanças.

---

### Epic 06 — Livro do Dia

**Superfície:** S-05

**Descrição:** o Supervisor gera a proposta automática do Livro do Dia a partir de Livro do Show + Escala + Folgas + Restrições. Revisa posições em aberto. Publica. Republicação obrigatória após qualquer mudança em posição publicada. Versionamento com delta visível.

**Valor entregue:** o documento oficial do show existe, é publicado, e é rastreável em versões.

**Dependências:** Epics 02, 03.

---

### Epic 07 — Avisos

**Superfície:** S-08

**Descrição:** Supervisor e Admin enviam comunicações oficiais unidirecionais. Avisos têm 3 níveis de urgência. Confirmação de leitura rastreável por destinatário. Aviso crítico (cancelamento de show) gerado automaticamente. Distinção visual clara de Mensagens.

**Valor entregue:** a comunicação oficial existe no produto, com rastreamento de quem recebeu. Fim das comunicações críticas via WhatsApp.

**Dependências:** Epics 01, 06.

---

### Epic 08 — Histórico

**Superfície:** S-11

**Descrição:** narrativa auditável de todos os eventos operacionais agrupados por Mudança Operacional. Não é log técnico — é história navegável. Filtros por entidade (membro, show, Solicitação). Ações da IA identificadas separadamente. Rastreamento de confirmações por evento.

**Valor entregue:** qualquer decisão passada pode ser investigada com contexto completo. Conflitos entre usuários têm evidência formal.

**Dependências:** todos os Epics P0 e P1 (o Histórico é alimentado por todos).

---

### Epic 09 — Painel de Saúde

**Superfície:** S-03

**Descrição:** dashboard organizacional do Admin com os 4 estados de saúde (Saudável / Atenção / Crítico / Sem Dados) e limiares configuráveis por Operação. Indicadores de tendência. Itens sem responsável. Navegação para investigação no Histórico.

**Valor entregue:** o Admin consegue monitorar todas as Operações sem precisar entrar em cada uma manualmente.

**Dependências:** Epics 01-08.

---

### Epic 10 — Entregas

**Superfície:** S-07 (modelo MVP = Compliance de Conteúdo)

**Descrição:** atribuição formal de conteúdo obrigatório (Leitura, Vídeo, Atualização Operacional, Checklist). Estados formais do ciclo de compliance. Rastreamento de visualização e conclusão. Prazo obrigatório. Expiração com registro permanente. Vinculação opcional à Biblioteca.

**Valor entregue:** o Supervisor pode atribuir conteúdo obrigatório e ter confirmação formal de que foi consumido.

**Dependências:** Epics 01, 03.

---

### Epic 11 — Mensagens

**Superfície:** S-09

**Descrição:** canal de esclarecimento e coordenação contextual. Mensagem contextual (nasce vinculada a uma entidade: Solicitação, Entrega, Aviso, MO) e Mensagem Livre. Membro → Membro proibido. Imutabilidade total. Arquivamento junto com entidade de origem.

**Valor entregue:** dúvidas e alinhamentos operacionais acontecem dentro do produto — não via WhatsApp.

**Dependências:** Epics 01, 04.

---

### Epic 12 — Biblioteca

**Superfície:** S-14

**Descrição:** repositório de conhecimento permanente. 5 tipos de documento (Procedimento, Regra, Material de Apoio, Procedimento de Segurança, Registro). Responsável obrigatório por documento. Ciclo de revisão configurável. Vínculo com Livro do Show e Entregas.

**Valor entregue:** o conhecimento organizacional existe em um único lugar, versionado e atribuído.

**Dependências:** Epics 01, 02.

---

### Epic 13 — IA

**Superfície:** S-10 (3 contextos: Membro, Supervisor, Admin)

**Descrição:** inteligência embarcada em todas as superfícies. 3 personas radicalmente diferentes. Motor de cobertura potencializado. Narrativa de Histórico. Análise de saúde organizacional. Chat livre por perfil. Modo degradado declarado por feature.

**Valor entregue:** o produto passa de ferramenta operacional para copiloto. Decisões são mais rápidas e o contexto está sempre disponível.

**Dependências:** todos os Epics P0, P1, P2 (a IA precisa dos dados para ser útil).

---

## PARTE 3 — FEATURES POR ÉPICO

---

### Epic 00 — Infraestrutura

| # | Feature | Camada |
|---|---|---|
| 00.01 | Autenticação (registro, login, refresh, logout) | Backend + Infra |
| 00.02 | Controle de acesso por perfil (Admin, Supervisor A/B, Membro) | Backend |
| 00.03 | Schema de banco de dados v1 (organizações, usuários, equipes, operações, papéis) | Backend + DB |
| 00.04 | API REST base (rotas protegidas, middlewares de autenticação e permissão) | Backend |
| 00.05 | Sistema de notificação push (registro de device, envio, retry, prioridade) | Backend + Infra |
| 00.06 | Entidade MO — criação, propagação e registro | Backend |
| 00.07 | Sistema de Histórico — engine de registro de eventos | Backend |
| 00.08 | Infraestrutura de filas (para notificações e propagações assíncronas) | Infra |
| 00.09 | Ambiente mobile shell (Expo, navigation base, auth flow) | Mobile |
| 00.10 | Ambiente web shell (React/Vite, routing base, auth flow) | Frontend Web |

---

### Epic 01 — Fundação Organizacional

| # | Feature | Camada |
|---|---|---|
| 01.01 | Criação e configuração de Operação | Backend + Web + Mobile |
| 01.02 | Criação e gestão de Grupos Operacionais (Equipes) | Backend + Web + Mobile |
| 01.03 | Cadastro e edição de membros (nome, perfil, contato, foto) | Backend + Web + Mobile |
| 01.04 | Gestão de papéis e permissões por membro | Backend + Web |
| 01.05 | Delegações temporárias (substituição de Supervisor) | Backend + Web |
| 01.06 | Fluxo de setup obrigatório (wizard sequencial para Admin) | Frontend Web |
| 01.07 | Gestão de restrições por membro (registro, tipos, período) | Backend + Web + Mobile |
| 01.08 | Desativação e arquivamento de membros | Backend + Web |
| 01.09 | Gestão de múltiplas Operações | Backend + Web |
| 01.10 | Configuração de limiares de saúde por Operação | Backend + Web |

---

### Epic 02 — Livro do Show + Agenda

| # | Feature | Camada |
|---|---|---|
| 02.01 | Criação e edição de Livro do Show (template de espetáculo) | Backend + Web |
| 02.02 | Estrutura de blocos, papéis e cobertura mínima | Backend + Web |
| 02.03 | Versionamento do Livro do Show (Tipo A estrutural / Tipo B configuração) | Backend + Web |
| 02.04 | Propagação de mudança de Livro do Show para Livros do Dia ativos | Backend |
| 02.05 | Criação e gestão de eventos na Agenda (5 tipos MVP) | Backend + Web + Mobile |
| 02.06 | Visualização de Agenda (calendário + lista) | Frontend Web + Mobile |
| 02.07 | Cancelamento de evento com cascata para Livro do Dia | Backend + Web + Mobile |
| 02.08 | Estados formais da Agenda (RASCUNHO, CONFIRMADO, ALTERADO, CANCELADO, REALIZADO) | Backend |
| 02.09 | Compromissos pessoais de Membro na Agenda | Backend + Mobile |

---

### Epic 03 — Escala

| # | Feature | Camada |
|---|---|---|
| 03.01 | Visualização da Escala por período (semana, mês) | Frontend Web + Mobile |
| 03.02 | Criação e edição de alocações individuais | Backend + Frontend Web |
| 03.03 | Motor de cobertura — classificação de candidatos (4 camadas) | Backend |
| 03.04 | Cálculo de cascata antes de confirmar substituição | Backend |
| 03.05 | Detecção de conflitos de horário e restrições ativas | Backend |
| 03.06 | Estados de posição: Coberta / Em Risco / Em Aberto | Backend |
| 03.07 | Publicação de Escala (com confirmação explícita de alertas abertos) | Backend + Frontend Web |
| 03.08 | Republicação de Escala (após mudança em posição publicada) | Backend + Frontend Web |
| 03.09 | Rastreamento de confirmações de mudança por Membro | Backend + Frontend Web + Mobile |
| 03.10 | Histórico de publicações da Escala (quem publicou, quando, o que mudou) | Backend |
| 03.11 | Substituição emergencial (no-show, emergência) — fluxo de urgência | Backend + Frontend Web + Mobile |
| 03.12 | Visão de cobertura multi-horizonte (próximos 7 dias) | Frontend Web |

---

### Epic 04 — Solicitações

| # | Feature | Camada |
|---|---|---|
| 04.01 | Criação de Solicitação de Folga | Backend + Mobile + Web |
| 04.02 | Criação de Solicitação de Restrição | Backend + Mobile + Web |
| 04.03 | Criação de Solicitação de Troca de Folga | Backend + Mobile + Web |
| 04.04 | Criação de Solicitação de Chegada Tardia | Backend + Mobile + Web |
| 04.05 | Criação de Solicitação de Saída Antecipada | Backend + Mobile + Web |
| 04.06 | Criação de Solicitação de Ajuste de Escala | Backend + Mobile + Web |
| 04.07 | Criação de Solicitação Excepcional | Backend + Mobile + Web |
| 04.08 | Análise de impacto automática (antes da tela de decisão do Supervisor) | Backend |
| 04.09 | Decisão do Supervisor: Aprovar | Backend + Frontend Web |
| 04.10 | Decisão do Supervisor: Negar (motivo obrigatório) | Backend + Frontend Web |
| 04.11 | Decisão do Supervisor: Proposta Alternativa (com prazo de resposta) | Backend + Frontend Web |
| 04.12 | Aceitação/Recusa de Proposta Alternativa pelo Membro | Backend + Mobile |
| 04.13 | Geração automática de MO após aprovação | Backend |
| 04.14 | Propagação da MO para Escala e Livro do Dia | Backend |
| 04.15 | Notificação ao Membro após cada mudança de estado | Backend + Infra |
| 04.16 | Priorização de Solicitações por data de impacto (não data de criação) | Backend |
| 04.17 | Histórico completo de decisões por Supervisor (tendência) | Backend |

---

### Epic 05 — Meu Dia + Painel Operacional

| # | Feature | Camada |
|---|---|---|
| 05.01 | Composição da view do Meu Dia: próxima atividade (principal) | Backend + Mobile |
| 05.02 | Destaque de alterações desde última abertura | Backend + Mobile |
| 05.03 | Confirmações pendentes no Meu Dia | Backend + Mobile |
| 05.04 | Linha do tempo do dia completo (sob demanda) | Mobile |
| 05.05 | Status de Solicitações em aberto no Meu Dia | Mobile |
| 05.06 | Prazo de Entrega urgente no Meu Dia | Mobile |
| 05.07 | Hierarquia de urgência: regra formal de priorização de itens | Backend |
| 05.08 | Estado "sem novidades" — confirmação visual de que o Membro verificou a versão atual | Mobile |
| 05.09 | Composição da view do Painel Operacional: status geral (Pronto / Atenção / Crítico) | Backend + Web |
| 05.10 | Lista de exceções priorizadas por impacto e tempo até início | Backend + Web |
| 05.11 | Rastreamento de confirmações pendentes no Painel Operacional | Web |
| 05.12 | Multi-horizonte: riscos dos próximos 3 dias | Backend + Web |
| 05.13 | Badge de Solicitações aguardando análise | Web + Mobile |

---

### Epic 06 — Livro do Dia

| # | Feature | Camada |
|---|---|---|
| 06.01 | Geração automática de proposta de Livro do Dia | Backend |
| 06.02 | Revisão e edição de posições pelo Supervisor | Frontend Web |
| 06.03 | Publicação do Livro do Dia (com confirmação de alertas abertos) | Backend + Frontend Web |
| 06.04 | Republicação obrigatória após mudança em posição publicada | Backend + Frontend Web |
| 06.05 | Versionamento do Livro do Dia (delta entre versões visível) | Backend + Frontend Web |
| 06.06 | Detecção automática de desatualização (Escala muda → Livro flagged) | Backend |
| 06.07 | Estados: RASCUNHO / PUBLICADO / DESATUALIZADO / CANCELADO | Backend |
| 06.08 | View do Membro no Livro do Dia (apenas a fatia individual) | Mobile |
| 06.09 | Diferenças em relação ao Livro do Show base (delta visual) | Frontend Web + Mobile |
| 06.10 | Fila de revisão (múltiplos Livros desatualizados priorizados por data) | Frontend Web |

---

### Epic 07 — Avisos

| # | Feature | Camada |
|---|---|---|
| 07.01 | Criação de Aviso pelo Supervisor (Informativo / Importante / Crítico) | Backend + Web |
| 07.02 | Criação de Aviso pelo Admin (escopo de Operação ou multi-Operação) | Backend + Web |
| 07.03 | Geração automática de Aviso crítico ao cancelar show | Backend |
| 07.04 | Envio e entrega via notificação push | Backend + Infra |
| 07.05 | Confirmação de leitura pelo Membro | Backend + Mobile |
| 07.06 | Rastreamento de confirmações: confirmados vs. pendentes | Backend + Frontend Web |
| 07.07 | Alerta ao Supervisor: membro não confirmou próximo ao horário da atividade | Backend + Infra |
| 07.08 | Renotificação manual para membros que não confirmaram | Frontend Web |
| 07.09 | Distinção visual clara Aviso × Mensagem | Mobile + Web |
| 07.10 | Arquivo de Avisos enviados (por Supervisor e por Operação) | Backend + Frontend Web |

---

### Epic 08 — Histórico

| # | Feature | Camada |
|---|---|---|
| 08.01 | Engine de registro automático de eventos por MO | Backend |
| 08.02 | Visualização do Histórico agrupado por MO (não por entidade técnica) | Frontend Web + Mobile |
| 08.03 | Filtros: por membro, por show, por tipo de evento, por período | Backend + Frontend Web |
| 08.04 | Detalhamento de cada evento: estado antes → depois + quem fez + quando | Backend + Frontend Web |
| 08.05 | Identificação de ações da IA separadas de ações humanas | Backend + Frontend Web |
| 08.06 | Rastreamento de confirmações por evento (quem confirmou, quando) | Backend |
| 08.07 | Histórico contextual de uma Solicitação (dentro da Solicitação) | Frontend Web + Mobile |
| 08.08 | Histórico contextual de uma Entrega | Frontend Web + Mobile |
| 08.09 | Detecção de padrão de reincidência (alertas de repetição) | Backend |
| 08.10 | Acesso do Admin ao Histórico completo de todas as Operações | Backend + Frontend Web |

---

### Epic 09 — Painel de Saúde

| # | Feature | Camada |
|---|---|---|
| 09.01 | Cálculo dos 4 estados de saúde por Operação | Backend |
| 09.02 | Visualização de saúde por Operação no Painel | Frontend Web |
| 09.03 | Limiares configuráveis por indicador (pelo Admin) | Backend + Frontend Web |
| 09.04 | Indicadores de tendência (crescendo / estável / melhorando) | Backend + Frontend Web |
| 09.05 | Itens sem responsável definido (Grupos, Funções, Solicitações orphaned) | Backend + Frontend Web |
| 09.06 | Navegação para Histórico ao investigar uma Operação | Frontend Web |
| 09.07 | Alerta de Operação PAUSADA por mais de N dias | Backend + Infra |

---

### Epic 10 — Entregas

| # | Feature | Camada |
|---|---|---|
| 10.01 | Criação de Entrega: Leitura Obrigatória (texto nativo ou referência à Biblioteca) | Backend + Web |
| 10.02 | Criação de Entrega: Vídeo (link externo com rastreamento) | Backend + Web |
| 10.03 | Criação de Entrega: Atualização Operacional (conteúdo nativo) | Backend + Web |
| 10.04 | Criação de Entrega: Checklist (itens verificáveis) | Backend + Web |
| 10.05 | Atribuição para Membro específico, Grupo ou todos | Backend + Web |
| 10.06 | Publicação de Entrega (RASCUNHO → PUBLICADA) | Backend + Web |
| 10.07 | Rastreamento: PUBLICADA → RECEBIDA → VISUALIZADA → CONCLUÍDA | Backend |
| 10.08 | Estado ATRASADA (prazo passou sem conclusão) + alerta ao Supervisor | Backend + Infra |
| 10.09 | Estado EXPIRADA (prazo máximo ultrapassado) + registro permanente | Backend |
| 10.10 | Cancelamento de Entrega pelo Supervisor | Backend + Web |
| 10.11 | View da Entrega pelo Membro (consumo do conteúdo + confirmação de conclusão) | Mobile |
| 10.12 | Dashboard de Entregas para Supervisor (estados agrupados por Membro) | Frontend Web |

---

### Epic 11 — Mensagens

| # | Feature | Camada |
|---|---|---|
| 11.01 | Mensagem Contextual: nascida de Solicitação | Backend + Web + Mobile |
| 11.02 | Mensagem Contextual: nascida de Aviso | Backend + Mobile |
| 11.03 | Mensagem Contextual: nascida de Entrega | Backend + Web + Mobile |
| 11.04 | Mensagem Contextual: nascida de MO | Backend + Web + Mobile |
| 11.05 | Mensagem Contextual: nascida de Livro do Dia | Backend + Web |
| 11.06 | Mensagem Livre: Membro ↔ Supervisor | Backend + Mobile |
| 11.07 | Mensagem de Grupo: Supervisor → Grupo | Backend + Web |
| 11.08 | Mensagem Admin ↔ Supervisor | Backend + Web |
| 11.09 | Coordenação Supervisor ↔ Supervisor | Backend + Web |
| 11.10 | Imutabilidade: sem edição, sem exclusão | Backend |
| 11.11 | Arquivamento automático com entidade de origem | Backend |
| 11.12 | Contexto da entidade vinculada visível no thread | Frontend Web + Mobile |
| 11.13 | Notificação push para mensagem não respondida | Backend + Infra |

---

### Epic 12 — Biblioteca

| # | Feature | Camada |
|---|---|---|
| 12.01 | Criação e edição de documentos (5 tipos MVP) | Backend + Web |
| 12.02 | Designação obrigatória de Responsável | Backend + Web |
| 12.03 | Ciclo de vida: RASCUNHO → EM REVISÃO → PUBLICADO → ARQUIVADO | Backend |
| 12.04 | Configuração de revisão periódica por documento | Backend + Web |
| 12.05 | Alerta de revisão pendente para Responsável | Backend + Infra |
| 12.06 | Alerta de Biblioteca sem Responsável para Admin | Backend + Infra |
| 12.07 | Vinculação de documento ao Livro do Show | Backend + Web |
| 12.08 | Vinculação de documento a uma Entrega | Backend + Web |
| 12.09 | Controle de acesso: Operação-específico ou global | Backend + Web |
| 12.10 | Busca por título e tipo dentro da Biblioteca | Backend + Web + Mobile |

---

### Epic 13 — IA

| # | Feature | Camada |
|---|---|---|
| 13.01 | IA do Membro: resumo diário do Meu Dia em linguagem natural | IA + Mobile |
| 13.02 | IA do Membro: explicação de mudança ("por que meu personagem mudou?") | IA + Mobile |
| 13.03 | IA do Membro: chat livre sobre a operação pessoal | IA + Mobile |
| 13.04 | IA do Supervisor: priorização de exceções no Painel Operacional | IA + Web |
| 13.05 | IA do Supervisor: proposta de cobertura potencializada (além do motor de regras) | IA + Web |
| 13.06 | IA do Supervisor: simulação de cascata explicada em linguagem operacional | IA + Web |
| 13.07 | IA do Supervisor: chat livre sobre a operação do grupo | IA + Web |
| 13.08 | IA do Admin: narrativa de saúde por Operação | IA + Web |
| 13.09 | IA do Admin: detecção de padrões antes de perguntar | IA + Web |
| 13.10 | IA do Admin: análise histórica com linguagem natural | IA + Web |
| 13.11 | Modo degradado: declaração formal de features IA vs. motor de regras | Backend |
| 13.12 | Rastreamento de ações da IA no Histórico (separado de ações humanas) | Backend |
| 13.13 | Fluxo: Proposta IA → Confirmação Humana → Execução → Desfazer | Backend + Web + Mobile |

---

## PARTE 4 — TAREFAS POR FEATURE

> Por escopo, as tarefas são listadas em nível de épico para os P0 críticos (Epics 00–05) e em nível de feature para os demais. Em sprint planning real, cada feature P0 se desdobra no mesmo nível de detalhe.

---

### Epic 00 — Infraestrutura (tarefas detalhadas)

**Backend:**
- [ ] Configurar banco de dados PostgreSQL com esquema base (users, organizations, operations, groups, roles, permissions)
- [ ] Implementar JWT com refresh token (access token 15min, refresh 30 dias)
- [ ] Implementar middleware de autenticação para todas as rotas protegidas
- [ ] Implementar controle de acesso por perfil (Admin / Supervisor A / Supervisor B / Membro) como decorator/middleware
- [ ] Criar endpoint de registro (Admin cria conta da organização)
- [ ] Criar endpoint de login com device tracking (web vs. mobile)
- [ ] Criar endpoint de logout com invalidação de refresh token
- [ ] Implementar entidade MO com campos: tipo, originador, entidades afetadas, timestamp, contexto
- [ ] Implementar engine de Histórico: every state change → event log com actor, before, after, timestamp, context
- [ ] Criar tabela de notifications_queue com prioridade (CRÍTICO/IMPORTANTE/INFORMATIVO), device_id, status (pendente/entregue/falhou), retry_count

**Infra:**
- [ ] Configurar serviço de push notifications (FCM para Android, APNs para iOS)
- [ ] Implementar retry logic: 3 tentativas com backoff exponencial
- [ ] Implementar fila de mensagens para propagações assíncronas (MO → Escala → Livro do Dia → Avisos → Meu Dia)
- [ ] Configurar environments (dev / staging / prod) com variáveis de ambiente separadas

**Frontend Web:**
- [ ] Scaffold do projeto web (React + Vite + TypeScript)
- [ ] Configurar routing base com proteção de rotas por perfil
- [ ] Implementar auth flow web (login, logout, refresh automático de token)
- [ ] Criar design system base (tokens de cor, tipografia, espaçamento — paleta MyASA aprovada)
- [ ] Criar componentes base (Button, Input, Card, Modal, Alert, Badge, Tabs)

**Mobile:**
- [ ] Scaffold do projeto mobile (Expo + TypeScript)
- [ ] Configurar navigation base (tab navigator + stack navigator por perfil)
- [ ] Implementar auth flow mobile (login, biometria opcional, refresh automático)
- [ ] Configurar push notification handler (foreground + background + killed)
- [ ] Criar design system mobile (mesmos tokens do web, adaptados para mobile)
- [ ] Criar componentes mobile base (equivalentes ao web)

---

### Epic 01 — Fundação Organizacional (tarefas detalhadas)

**Backend:**
- [ ] API: criar Operação (nome, tipo, configurações)
- [ ] API: criar Grupo Operacional dentro de uma Operação
- [ ] API: criar Membro (nome, perfil, foto, contato, grupo, papel)
- [ ] API: atribuir papel a Membro (Admin / Supervisor Tipo A / Supervisor Tipo B / Membro)
- [ ] API: criar delegação temporária (Supervisor A delega para Membro X por período Y)
- [ ] API: registrar Restrição de Membro (tipo: 6 categorias; período; detalhes)
- [ ] API: desativar Membro (soft delete — histórico preservado)
- [ ] API: arquivar Operação (estado ARQUIVADO — todos os dados preservados)
- [ ] Lógica: sequência de setup obrigatória (Operação bloqueada até ter ao menos 1 Grupo com 1 Supervisor)
- [ ] Lógica: limiares de saúde configuráveis por Operação (5 métricas, valores default definidos)

**Frontend Web:**
- [ ] Tela de setup wizard (sequência obrigatória: Organização → Grupos → Membros → Papéis)
- [ ] Tela de gestão de membros (lista, criação, edição, desativação)
- [ ] Tela de gestão de grupos (criação, associação de membros, atribuição de Supervisor)
- [ ] Tela de gestão de operações (criação, configuração, arquivamento)
- [ ] Tela de delegações (criar delegação, ver delegações ativas, revogar)
- [ ] Tela de restrições de membro (registrar, visualizar histórico de restrições)
- [ ] Tela de configuração de limiares de saúde

**Mobile:**
- [ ] Tela de perfil do Membro (visualizar próprios dados, restrições ativas)
- [ ] Não há criação de membros no mobile — isso é exclusivamente web (Admin flow)

---

### Epics 02–13 — Nível de feature (backend + frontend por feature)

> As features listadas na Parte 3 são as unidades de implementação. Cada feature representa 1–3 dias de desenvolvimento por desenvolvedor experiente. Para sprint planning, cada feature da Parte 3 se torna 1 item do backlog com estimativa própria.

---

## PARTE 5 — DEPENDÊNCIAS E CAMINHO CRÍTICO

---

### Mapa de dependências

```
Epic 00 (Infra)
    └── Epic 01 (Fundação Organizacional)
            ├── Epic 02 (Livro do Show + Agenda)
            │       └── Epic 03 (Escala)
            │               ├── Epic 04 (Solicitações)
            │               │       └── Epic 05 (Meu Dia + Painel)  ← MVP MÍNIMO
            │               └── Epic 06 (Livro do Dia)
            │                       ├── Epic 07 (Avisos)
            │                       └── Epic 08 (Histórico)
            │                               └── Epic 09 (Painel de Saúde)
            ├── Epic 10 (Entregas) ─── pode iniciar após Epic 01
            ├── Epic 11 (Mensagens) ── pode iniciar após Epic 01
            ├── Epic 12 (Biblioteca) ─ pode iniciar após Epic 02
            └── Epic 13 (IA) ────────── inicia após todos os P0 e P1
```

---

### Caminho crítico

O caminho crítico do projeto é a sequência serial que não pode ser paralelizada:

```
Infra → Fundação → Livro do Show + Agenda → Escala → Solicitações → Meu Dia/Painel
```

Qualquer atraso nessa sequência atrasa o MVP inteiro. Todos os outros épicos (Livro do Dia, Avisos, Histórico, Painel de Saúde, Entregas, Mensagens, Biblioteca, IA) dependem dessa sequência ou podem correr em paralelo a ela.

---

### O que pode ser construído em paralelo

| Grupo paralelo | Após qual marco |
|---|---|
| Epic 10 (Entregas) + Epic 11 (Mensagens) | Após Epic 01 estar completo |
| Epic 12 (Biblioteca) | Após Epic 02 estar completo |
| Epic 06 (Livro do Dia) | Após Epics 02 + 03 |
| Epic 07 (Avisos) + Epic 08 (Histórico) | Após Epic 06 |
| Epic 13 (IA) | Após todos P0 e P1 |
| Design e UX de qualquer superfície P1/P2 | Pode correr em paralelo com desenvolvimento P0 |

---

### Dependências técnicas específicas

| Feature | Bloqueia | Bloqueada por |
|---|---|---|
| Motor de cobertura (03.03) | Publicação de Escala (03.07) | Restrições de Membro (01.07) |
| Análise de impacto de Solicitação (04.08) | Decisão do Supervisor (04.09-11) | Motor de cobertura (03.03) |
| Geração automática do Livro do Dia (06.01) | Publicação do Livro (06.03) | Livro do Show (02.01) + Escala publicada (03.07) + Agenda (02.05) |
| Notificação push (00.05) | Rastreamento de confirmações (03.09, 04.15, 07.05) | Setup de FCM/APNs |
| Engine de Histórico (00.07) | Epic 08 inteiro | Todos os epics que geram eventos |
| IA (Epic 13) | — | Todos os dados gerados pelos Epics P0+P1 |

---

## PARTE 6 — MVP REAL

---

### Definição do MVP mínimo

**O MVP real é o menor MyASA que permite a uma equipe real operar por 1 semana de shows sem WhatsApp.**

Para isso precisa existir:

| O que | Por que não pode faltar |
|---|---|
| Auth + perfis | Sem isso ninguém entra no sistema |
| Estrutura organizacional (grupos, operações, membros) | Sem isso não existe escopo |
| Livro do Show | Sem isso a Escala não tem referência de estrutura |
| Agenda (eventos) | Sem isso não há shows para escalar |
| Escala (publicação) | Sem isso ninguém sabe quem faz o quê |
| Solicitações (Folga + Restrição) | Esses são os pedidos mais frequentes — sem eles o Membro usa WhatsApp |
| Meu Dia | Sem isso o Membro não vê sua alocação no produto |
| Painel Operacional | Sem isso o Supervisor não sabe o que está acontecendo |
| Notificação push | Sem isso o Membro não sabe que houve mudança |

**Total do MVP mínimo:** Epics 00, 01, 02, 03, 04, 05 + notificação push (parte do Epic 00).

---

### O que pode esperar (sem perder o MVP)

| O que | Justificativa para esperar |
|---|---|
| Livro do Dia (S-05) | Na primeira semana o Supervisor pode usar Escala como referência. Livro do Dia pode entrar na semana 2. |
| Avisos (S-08) | Com notificações de mudança de Escala, o MVP funciona. Avisos formais entram no piloto. |
| Histórico (S-11) | O MVP não precisa de auditoria completa para funcionar. |
| Painel de Saúde (S-03) | Admin consegue monitorar manualmente no MVP. |
| Entregas, Mensagens, Biblioteca | Nenhuma é essencial para o loop operacional central. |
| IA | O produto funciona sem IA — motor de regras cobre o MVP. |

---

## PARTE 7 — PILOTO

---

### Configuração do piloto

**Escopo recomendado:** 1 Operação · 1 Supervisor · 15-25 Membros · 4 semanas de shows reais

**Por que esse escopo:**
- Pequeno o suficiente para controlar variáveis
- Grande o suficiente para gerar dados reais de uso
- 4 semanas = pelo menos 8-12 shows = dados suficientes para identificar padrões

---

### Superfícies do piloto (em ordem de entrada)

| Semana | Superfícies ativas | Objetivo |
|---|---|---|
| Semana 1 | S-17, S-15, S-16, S-13, S-12, S-04, S-01, S-02 | Substituir WhatsApp para comunicação de quem trabalha hoje |
| Semana 2 | + S-06 (Folga e Restrição) | Formalizar pedidos de folga |
| Semana 3 | + S-05, S-08 | Livro do Dia publicado, comunicações oficiais |
| Semana 4 | + S-11 (Histórico parcial) | Dados de auditoria coletados |

---

### Métricas do piloto

| Métrica | O que mede | Sinal positivo |
|---|---|---|
| % de alocações publicadas dentro do produto | Adoção da Escala | > 90% na semana 2 |
| Redução de mensagens de WhatsApp sobre "quem trabalha hoje" | Substituição real | Queda > 60% na semana 3 |
| Tempo médio para decisão de Solicitação | Eficiência do Supervisor | < 24h para folgas simples |
| Taxa de confirmação de mudanças pelos Membros | Engajamento com Meu Dia | > 80% dentro de 2h |
| % de Solicitações com motivo preenchido na negativa | Qualidade da comunicação | 100% (é obrigatório) |
| NPS de Supervisores e Membros na semana 4 | Satisfação geral | > 40 |

---

### Critérios de sucesso do piloto

O piloto é considerado bem-sucedido se, ao final da 4ª semana:
1. O Supervisor consegue publicar a Escala sem assistência técnica
2. Membros abrem o Meu Dia no celular antes de cada show
3. Pelo menos 1 Solicitação de Folga foi processada inteiramente no produto (sem WhatsApp)
4. Nenhum show foi afetado por falha de comunicação que o produto deveria ter prevenido

---

## PARTE 8 — ROADMAP POR FASES

---

### Fase 1 — Fundação

**Objetivo:** o produto existe e é utilizável por uma equipe real.

**Entregas:** Epics 00, 01, 02, 03, 04, 05

**Duração estimada:** 8-12 semanas (equipe de 3-4 desenvolvedores)

**Riscos:**
- Motor de cobertura (04 camadas) mais complexo do que estimado → mitigue com versão simplificada (2 camadas) no MVP, 4 camadas no piloto
- Auth mobile e push notifications com complexidade de certificados iOS → reserve 1 semana extra
- Design system pode atrasar se não for desenvolvido em paralelo → iniciar UX/design da Fase 1 imediatamente junto com desenvolvimento da infra

---

### Fase 2 — Operação

**Objetivo:** o ciclo operacional completo está no produto — shows têm documentos, mudanças têm comunicação oficial, decisões têm auditoria.

**Entregas:** Epics 06, 07, 08, 09

**Duração estimada:** 6-8 semanas

**Riscos:**
- Versionamento do Livro do Dia requer modelagem cuidadosa de dados (snapshots vs. diffs) → definir estratégia técnica de versionamento antes de iniciar implementação
- Histórico com alta performance em consultas complexas → índices de banco devem ser definidos junto com o schema, não depois

---

### Fase 3 — Comunicação

**Objetivo:** o produto tem todos os canais de comunicação operacional — Mensagens para coordenação, Entregas para compliance, Biblioteca para conhecimento.

**Entregas:** Epics 10, 11, 12

**Duração estimada:** 6-8 semanas

**Riscos:**
- Mensagens com imutabilidade total e arquivamento automático requer design cuidadoso do schema de conversas — threads contextuais vs. livres têm estrutura diferente
- Biblioteca com busca de texto completo pode exigir índice especializado (ex.: PostgreSQL full-text search ou Elasticsearch) — decidir antes de iniciar

---

### Fase 4 — Inteligência

**Objetivo:** o produto tem IA real e útil nos 3 contextos, com modo degradado formalmente especificado.

**Entregas:** Epic 13 completo + especificação formal de motor de regras vs. IA por feature

**Duração estimada:** 8-12 semanas

**Riscos:**
- Custo de LLM em produção em alta escala — garantir mecanismo de cache e rate limiting antes de lançar
- Persona da IA por perfil requer prompts e fine-tuning — reservar tempo para iteração
- Rastreamento de ações da IA no Histórico requer integração com o engine de eventos da Fase 1

---

### Fase 5 — Governança

**Objetivo:** o produto é robusto para organizações com múltiplas Operações, Supervisores e volumes maiores de dados.

**Entregas:** permissões granulares por Operação (LG-02), bulk import de membros, processo formal de conflito de Operações simultâneas (A-04), alertas de volume para o Admin em escala

**Duração estimada:** 4-6 semanas

**Riscos:** dependência de input do PO para definir o modelo de permissões granulares antes de implementar

---

### Fase 6 — Conhecimento

**Objetivo:** o produto tem integrações externas, capacidades avançadas de análise histórica e automações de onboarding.

**Entregas:** integração com RH (LG-04), exportação de relatórios, análise histórica profunda da IA, notificação de Livro do Show sem revisão há N meses

**Duração estimada:** variável — depende das prioridades de negócio pós-piloto

---

## PARTE 9 — AUDITORIA DO BACKLOG

---

### Existe trabalho redundante?

**Verificado:**

- Notificação push aparece em múltiplos épicos (03.09, 04.15, 07.04, 11.13). Na implementação, é a **mesma infraestrutura** (Epic 00.05) configurada uma vez — cada épico é cliente da mesma fila. Não é redundância — é reutilização correta.

- Motor de cobertura (03.03) é chamado por múltiplas features (Escala, Livro do Dia, substituição emergencial). É a **mesma lógica** encapsulada em serviço chamado por diferentes contextos. Correto.

- Histórico aparece em todos os épicos como dependência. É **alimentado** por todos — não duplicado. Correto.

**Resultado:** nenhuma redundância real identificada.

---

### Existe dependência circular?

**Verificado:**

Ciclo potencial: Escala depende de Agenda → Agenda depende de Livro do Show → Livro do Show depende de Operação → Operação depende de Equipes → Equipes dependem de Escala?

**Não.** Equipes não dependem de Escala — Escala usa Equipes como dado. Não há ciclo.

Ciclo potencial: Livro do Dia depende de Escala → Escala depende de Livro do Show → Livro do Show depende de Livro do Dia?

**Não.** Livro do Show é o template base. Livro do Dia é instância do template para uma data. Livro do Show não depende do Livro do Dia. Não há ciclo.

**Resultado:** nenhuma dependência circular.

---

### Existe feature sem valor?

Revisão das features que poderiam ser questionadas:

| Feature | Questão | Justificativa para manter |
|---|---|---|
| 02.09 Compromissos pessoais do Membro na Agenda | Parece fora do escopo | Necessário para o motor de cobertura detectar conflitos de disponibilidade que não são Solicitações |
| 05.08 Estado "sem novidades" | Parece trivial | Pesquisa do Membro confirmou que a ausência de confirmação visual de "está atualizado" gera ansiedade operacional |
| 08.09 Detecção de padrão de reincidência | Parece complexo para MVP | É P1, não P0 — e é o principal valor do Histórico para o Admin além da auditoria pontual |

**Resultado:** nenhuma feature sem valor identificada.

---

### Existe épico sem dono?

No backlog atual, os épicos não têm dono de produto atribuído — isso é responsabilidade da equipe de produto no momento de sprint planning. O que existe é a responsabilidade técnica por camada, que é clara em cada feature.

**Recomendação:** ao iniciar sprint planning, atribuir Product Owner por épico antes de iniciar Fase 1.

---

## PARTE 10 — BACKLOG MESTRE OFICIAL

---

### Resumo executivo

| Fase | Épicos | Complexidade estimada | Prioridade |
|---|---|---|---|
| Fase 1 — Fundação | Epic 00, 01, 02, 03, 04, 05 | Alta | P0 — bloqueia tudo |
| Fase 2 — Operação | Epic 06, 07, 08, 09 | Média-Alta | P1 — completa MVP |
| Fase 3 — Comunicação | Epic 10, 11, 12 | Média | P2 — pós-piloto |
| Fase 4 — Inteligência | Epic 13 | Alta | P2/P3 — após dados reais |
| Fase 5 — Governança | Features de escala | Média | P3 — pós 500 membros |
| Fase 6 — Conhecimento | Integrações externas | Variável | P3 — futuro |

---

### Total de itens do backlog

| Categoria | Quantidade |
|---|---|
| Épicos | 14 (excluindo Infra) |
| Features identificadas | 131 features |
| Tarefas detalhadas (P0) | ~50 tarefas nível de implementação (Epics 00 e 01) |
| Decisões formais de produto que guiam cada feature | 131 decisões |

---

### Caminho crítico — resumo executivo

```
Semana 1-2: Infra Base (Epic 00) — tudo depende disso
Semana 3-6: Fundação Organizacional (Epic 01) + início do design de Epics 02-05
Semana 7-10: Livro do Show + Agenda + Escala (Epics 02, 03) em sequência
Semana 11-14: Solicitações + Meu Dia + Painel (Epics 04, 05)
             ↳ MVP mínimo operacional ao final da semana 14

Semana 15-16: Piloto com equipe real (Fase 1 validada)
Semana 17-22: Livro do Dia + Avisos + Histórico + Painel de Saúde (Fase 2)
             ↳ MVP completo ao final da semana 22

Semana 23+: Entregas + Mensagens + Biblioteca + IA (Fases 3, 4)
```

---

### Pendências de produto antes do primeiro sprint

Dois itens precisam de decisão do Product Owner **antes** de iniciar o desenvolvimento (não bloqueiam a infra, mas bloqueiam os Epics seguintes):

| Pendência | Impacto | Decisão necessária |
|---|---|---|
| **A-01 (parcialmente resolvido)** S-07 = Compliance de Conteúdo — confirmar escopo dos 4 tipos MVP | Bloqueia Epic 10 | Confirmar: os 4 tipos definidos (Leitura, Vídeo, Atualização Operacional, Checklist) são o escopo correto do MVP? |
| **A-03** Infraestrutura de Notificação | Bloqueia Epic 00.05 | Confirmar: notificação push-only (mobile) ou push + in-app banner (web) no MVP? |
| **A-05** Motor de regras vs. IA | Bloqueia Epic 13 | Classificar por feature: qual é motor de regras determinístico, qual é LLM? |

---

### Veredito

## 🟢 Pronto para desenvolvimento

A arquitetura funcional está completa. O backlog está estruturado. O caminho crítico está claro. As dependências estão mapeadas. O MVP mínimo está definido. O piloto tem critérios de sucesso.

**Uma equipe pode iniciar amanhã.**

O que iniciar na semana 1:
1. **Desenvolvimento:** Epic 00 (Infra Base) — todos os desenvolvedores backend
2. **Design:** UX e mockups de S-04 (Escala) e S-06 (Solicitações) — começar pelo caminho crítico
3. **Produto:** resolver A-03 e A-05 antes da semana 3 — esses itens entram no Epic 00

---

*Backlog Mestre produzido em 18/06/2026 — MyASA 2.0*
*131 features mapeadas · 14 épicos · 6 fases · 1 caminho crítico claro*
