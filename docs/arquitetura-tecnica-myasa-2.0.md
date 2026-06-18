# MyASA 2.0 — Arquitetura Técnica de Implementação

> **Versão:** 18/06/2026
> **Fase:** Arquitetura Técnica — anterior ao Sprint 1
> **Base:** Blueprint Executivo · Backlog Mestre · Plano MVP Piloto · Gate Final · 131 decisões formais
> **Destinatário:** equipe de desenvolvimento (backend, frontend, mobile, infra)
> **Status:** 🟢 Pronto para Sprint 1

---

## PARTE 1 — VISÃO TÉCNICA GERAL

---

### Padrão arquitetural: Monólito Modular com Bus de Eventos Interno

**Decisão:** Monólito Modular — não microsserviços, não monólito sem estrutura.

**Justificativa:**

O MyASA tem um modelo de dados altamente interconectado. A entidade MO é produzida e consumida por praticamente todos os domínios. Isso é um padrão que, em microsserviços, exige coordenação distribuída (saga pattern, 2-phase commit, eventual consistency) — overhead inaceitável para uma equipe pequena construindo um MVP.

O Monólito Modular entrega:
- Fronteiras de domínio respeitadas (cada módulo tem seu namespace, seu schema, sua interface pública)
- Comunicação via bus de eventos interno (não chamadas HTTP entre serviços)
- Deploy único (simplicidade operacional no piloto)
- Extração futura para microsserviços possível, se necessário, sem reescrever a lógica — apenas movendo módulos

**Quando sair do monólito:** quando um único domínio tiver requisitos de escala radicalmente diferentes dos outros (ex.: IA com alto volume de inferência). Isso não é problema do MVP.

---

### Stack tecnológica

| Camada | Tecnologia | Justificativa |
|---|---|---|
| **Backend** | Node.js + TypeScript + NestJS | Modularidade nativa (módulos NestJS = domínios), DI, guards de autenticação, suporte a event emitter interno |
| **Banco de dados** | PostgreSQL | ACID, JSON columns para payloads flexíveis (MO context, event before/after state), full-text search nativo |
| **Mobile** | React Native + Expo | Equipe única para iOS e Android, código compartilhado com web, suporte nativo a push |
| **Web** | React + Vite + TypeScript | Consistência de linguagem com backend e mobile, build rápido |
| **Tipos compartilhados** | Zod schemas (monorepo) | Contrato único entre frontend, mobile e backend — erros de tipo detectados em build time |
| **Autenticação** | JWT (access token 15min + refresh token 30 dias) | Sem estado no servidor, compatível com mobile e web |
| **Push Notifications** | Firebase Cloud Messaging (Android) + APNs (iOS) | Via serviço unificado (ex.: Expo Notifications) para abstração de plataforma |
| **Bus de eventos interno** | NestJS EventEmitter2 | In-process, zero overhead de rede, suficiente para MVP — extraível para Redis Streams em escala |
| **Fila para notificações** | Bull (Redis) | Retry com backoff, persistência de jobs pendentes, prioridade de filas |

---

### Diagrama de alto nível

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTES                                  │
│                                                                  │
│   ┌──────────────────┐          ┌──────────────────────────┐    │
│   │  App Mobile       │          │  Web App (Admin/Supervisor│    │
│   │  (React Native)   │          │  React + Vite)            │    │
│   └────────┬─────────┘          └────────────┬─────────────┘    │
└────────────┼────────────────────────────────┼──────────────────┘
             │ HTTPS / REST + JWT              │ HTTPS / REST + JWT
             └──────────────┬─────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                     API GATEWAY / NestJS                         │
│                                                                  │
│  Auth Guard → Role Guard → Rate Limiter → Controller             │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   MÓDULOS DE DOMÍNIO                      │   │
│  │                                                           │   │
│  │  Identidade │ Organização │ Equipes │ Agenda              │   │
│  │  Livro Show │ Escala      │ Livro Dia│ Solicitações       │   │
│  │  MO Engine  │ Avisos      │ Mensagens│ Entregas           │   │
│  │  Histórico  │ Biblioteca  │ IA       │ Notificações       │   │
│  │                                                           │   │
│  │  ←──────── BUS DE EVENTOS INTERNO ────────→              │   │
│  │                                                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
             │                          │
    ┌────────▼────────┐        ┌────────▼────────┐
    │   PostgreSQL     │        │  Redis (Bull)    │
    │   (dados)        │        │  (fila de push)  │
    └─────────────────┘        └────────┬─────────┘
                                         │
                              ┌──────────▼──────────┐
                              │  FCM / APNs          │
                              │  (push delivery)     │
                              └─────────────────────┘
```

---

## PARTE 2 — DOMÍNIOS TÉCNICOS

---

Cada domínio é um módulo NestJS independente com seu próprio service, repository, controller e event handlers. Domínios não chamam uns aos outros diretamente — comunicam via bus de eventos.

---

### Domínio: Identidade

**Responsabilidades:** autenticação, sessões, tokens, registro de devices para push.

**Eventos produzidos:**
- `identity.user.logged_in` → `{ userId, deviceId, platform, timestamp }`
- `identity.user.logged_out` → `{ userId, sessionId }`
- `identity.token.refreshed` → `{ userId }`
- `identity.device.registered` → `{ userId, deviceToken, platform }`

**Eventos consumidos:** nenhum (domínio raiz — não depende de outros).

---

### Domínio: Organização

**Responsabilidades:** organizações, operações, configuração de limiares de saúde.

**Eventos produzidos:**
- `org.operation.created` → `{ operationId, organizationId }`
- `org.operation.archived` → `{ operationId }`
- `org.health_threshold.updated` → `{ operationId, metric, value }`

**Eventos consumidos:** nenhum.

---

### Domínio: Equipes

**Responsabilidades:** grupos operacionais, membros, papéis, restrições, delegações.

**Eventos produzidos:**
- `teams.member.added` → `{ userId, groupId, operationId, role }`
- `teams.member.deactivated` → `{ userId, operationId }`
- `teams.role.changed` → `{ userId, operationId, previousRole, newRole }`
- `teams.restriction.created` → `{ userId, restrictionId, type, period }`
- `teams.restriction.expired` → `{ userId, restrictionId }`
- `teams.delegation.created` → `{ delegatorId, delegateeId, operationId, validUntil }`
- `teams.delegation.expired` → `{ delegationId }`

**Eventos consumidos:**
- `org.operation.created` → inicializa estrutura de grupo padrão

---

### Domínio: Agenda

**Responsabilidades:** eventos, shows, calendário operacional.

**Eventos produzidos:**
- `agenda.event.created` → `{ eventId, operationId, type, date }`
- `agenda.event.confirmed` → `{ eventId }`
- `agenda.event.changed` → `{ eventId, changedFields }`
- `agenda.event.cancelled` → `{ eventId, operationId, affectedAllocations[] }`
- `agenda.event.completed` → `{ eventId }`

**Eventos consumidos:**
- `org.operation.created` → inicializa Agenda da Operação

**Efeito colateral crítico:**
`agenda.event.cancelled` → consumido por Avisos (cria Aviso Crítico automático) + MO Engine (cria MO) + Escala (recalcula cobertura).

---

### Domínio: Livro do Show

**Responsabilidades:** templates de espetáculos, papéis, blocos, cobertura mínima, versionamento.

**Eventos produzidos:**
- `showbook.created` → `{ showBookId, operationId }`
- `showbook.version_created` → `{ showBookId, version, changeType }` (Tipo A estrutural / Tipo B config)
- `showbook.published` → `{ showBookId, version }`

**Eventos consumidos:**
- `org.operation.created` → habilita criação de Livro do Show

**Efeito colateral:**
`showbook.version_created` com Tipo A → consumido por Livro do Dia (flag Livros do Dia com este Show como DESATUALIZADO).

---

### Domínio: Escala

**Responsabilidades:** alocações, publicação, rastreamento de confirmações, motor de cobertura (delegado ao Motor de Regras).

**Eventos produzidos:**
- `scale.published` → `{ scaleId, groupId, operationId, changes[], timestamp }`
- `scale.allocation.changed` → `{ allocationId, userId, previousState, newState, eventId }`
- `scale.position.coverage_gap_detected` → `{ eventId, roleId, currentCoverage, minimumRequired }`
- `scale.change.confirmed_by_member` → `{ allocationId, userId, confirmedAt }`

**Eventos consumidos:**
- `agenda.event.created` → habilita criação de alocações para o evento
- `teams.restriction.created` → recalcula posições afetadas
- `teams.restriction.expired` → recalcula posições
- `solicitacoes.request.approved` → propaga alteração de alocação

**Regra crítica:** `scale.published` só é emitido após confirmação explícita do Supervisor (UI + validação backend). Publicação automática nunca acontece.

---

### Domínio: Livro do Dia

**Responsabilidades:** geração automática, publicação, versionamento, detecção de desatualização.

**Eventos produzidos:**
- `dailybook.generated` → `{ dailyBookId, eventId, version }`
- `dailybook.published` → `{ dailyBookId, version, supervisorId }`
- `dailybook.republished` → `{ dailyBookId, previousVersion, newVersion, delta }`
- `dailybook.outdated` → `{ dailyBookId, reason, triggeredBy }`

**Eventos consumidos:**
- `scale.published` → se Livro do Dia já existe para a data: emite `dailybook.outdated`
- `agenda.event.changed` → emite `dailybook.outdated`
- `showbook.version_created` (Tipo A) → emite `dailybook.outdated`

---

### Domínio: Solicitações

**Responsabilidades:** criação de pedidos, análise de impacto, decisão do Supervisor, propagação.

**Eventos produzidos:**
- `solicitacoes.request.created` → `{ requestId, requesterId, type, targetDate, operationId }`
- `solicitacoes.request.approved` → `{ requestId, supervisorId, moId }`
- `solicitacoes.request.denied` → `{ requestId, supervisorId, reason }` — reason sempre presente
- `solicitacoes.request.alternative_proposed` → `{ requestId, supervisorId, proposal, deadline }`
- `solicitacoes.request.alternative_accepted` → `{ requestId, userId }`
- `solicitacoes.request.alternative_rejected` → `{ requestId, userId }`

**Eventos consumidos:**
- `scale.published` → invalida análise de impacto em cache (recalcula se Escala mudou)

**Regra de integridade:** `request.denied` não pode ser emitido sem `reason` não-nulo. Validado no service antes de persistir.

---

### Domínio: MO Engine (Mudança Operacional)

**Responsabilidades:** criação automática de MOs, propagação para entidades afetadas, rastreamento da cadeia de eventos.

**Este domínio não tem controller nem endpoint próprio — é exclusivamente event-driven.**

**Eventos produzidos:**
- `mo.created` → `{ moId, type, actorId, actorType, affectedEntities[], correlationId }`
- `mo.propagated` → `{ moId, affectedSurfaces[] }`

**Eventos consumidos (triggers de MO):**
| Evento consumido | Tipo de MO criada |
|---|---|
| `scale.allocation.changed` após publicação | MO_SUBSTITUICAO ou MO_AJUSTE_ESCALA |
| `solicitacoes.request.approved` (folga) | MO_APROVACAO_FOLGA |
| `solicitacoes.request.approved` (restrição) | MO_NOVA_RESTRICAO |
| `agenda.event.cancelled` | MO_CANCELAMENTO_SHOW |
| `dailybook.published` com mudança de posição | MO_PUBLICACAO_LIVRO_DIA |
| `dailybook.republished` | MO_REPUBLICACAO_LIVRO_DIA |

**Regra crítica:** MO é sempre criada pelo sistema em resposta a eventos — nunca por ação direta de usuário.

---

### Domínio: Avisos

**Responsabilidades:** criação de avisos, entrega, rastreamento de confirmação.

**Eventos produzidos:**
- `avisos.created` → `{ avisoId, authorId, urgency, operationId, recipientIds[] }`
- `avisos.sent` → `{ avisoId, notificationJobIds[] }`
- `avisos.confirmed_by_member` → `{ avisoId, userId, confirmedAt }`

**Eventos consumidos:**
- `agenda.event.cancelled` → cria Aviso Crítico automaticamente para todos os membros alocados
- `mo.created` com tipo MO_CANCELAMENTO_SHOW → verifica se Aviso já foi criado (idempotência)

**Regra:** Aviso confirmado via notificação push ≠ Aviso confirmado no app. Confirmação real exige abertura do Aviso no app e ação explícita.

---

### Domínio: Mensagens

**Responsabilidades:** mensagens contextuais e livres, imutabilidade, arquivamento.

**Eventos produzidos:**
- `messages.created` → `{ messageId, senderId, recipientId, contextType, contextId, timestamp }`

**Eventos consumidos:** nenhum diretamente.

**Regra de imutabilidade:** `Message` não tem campo `updated_at`. Não existe endpoint PATCH ou DELETE para mensagens. Validado em nível de service e banco (sem operações de update/delete no repositório de mensagens).

---

### Domínio: Entregas

**Responsabilidades:** atribuição de conteúdo, rastreamento de estado binário, expiração.

**Eventos produzidos:**
- `deliveries.created` → `{ deliveryId, creatorId, operationId, type, dueDate }`
- `deliveries.published` → `{ deliveryId, assignmentIds[] }`
- `deliveries.assignment.completed` → `{ deliveryId, userId, completedAt }`
- `deliveries.assignment.overdue` → `{ deliveryId, userId }` (job scheduled)
- `deliveries.assignment.expired` → `{ deliveryId, userId }` (estado terminal, imutável)

**Eventos consumidos:** nenhum.

**Regra de imutabilidade do estado EXPIRADA:** uma vez que `DeliveryAssignment.status = EXPIRED`, nenhuma operação pode alterá-lo. Verificado no service: se status é EXPIRED, qualquer tentativa de update retorna erro 409.

---

### Domínio: Histórico

**Responsabilidades:** registro imutável de todos os eventos operacionais agrupados por MO.

**Eventos produzidos:** nenhum (domínio terminal — só consome).

**Eventos consumidos:**
- `mo.created` → cria HistoryEvent para cada entidade afetada
- `avisos.confirmed_by_member` → cria HistoryEvent de confirmação
- `deliveries.assignment.expired` → cria HistoryEvent permanente
- `solicitacoes.request.denied` → cria HistoryEvent com reason
- `scale.change.confirmed_by_member` → cria HistoryEvent

**Regra de imutabilidade:** `HistoryEvent` não tem operações de update ou delete. A tabela tem `REVOKE DELETE ON history_events FROM app_user` no banco. Nem o Admin tem interface para deletar entradas.

---

### Domínio: IA

**Responsabilidades:** motor determinístico (MVP) + preparação para LLM (Fase 4).

**Eventos produzidos:**
- `ai.coverage_suggestion.generated` → `{ suggestionId, eventId, roleId, rankedCandidates[] }`
- `ai.cascade_simulated` → `{ simulationId, proposedChange, cascadeImpacts[] }`
- `ai.exceptions_prioritized` → `{ prioritizedList[], scoringMethod }`

**Eventos consumidos:**
- `scale.position.coverage_gap_detected` → dispara CandidateRanker
- `solicitacoes.request.created` → dispara impact analysis

**Modo degradado:** se IA (LLM na Fase 4) estiver indisponível, todos os consumers da IA recebem resposta do motor determinístico sem falha. Nenhum fluxo operacional bloqueia por indisponibilidade de IA.

---

### Domínio: Notificações

**Responsabilidades:** entrega push, retry, tracking de entrega.

**Eventos produzidos:**
- `notifications.sent` → `{ notificationId, userId, platform }`
- `notifications.delivered` → `{ notificationId, deliveredAt }`
- `notifications.failed` → `{ notificationId, attempt, reason }`

**Eventos consumidos:** todos os eventos que geram notificação:
- `solicitacoes.request.approved/denied/alternative_proposed`
- `scale.published` (para membros afetados)
- `avisos.sent`
- `deliveries.assignment.overdue`
- `messages.created` (se não respondido em N horas)

---

## PARTE 3 — ENTIDADES TÉCNICAS

---

### Entidades Raiz (independentes)

```sql
Organization   { id uuid PK, name, created_at }
User           { id uuid PK, organization_id FK, name, email UNIQUE, photo_url, 
                 status enum(ACTIVE, INACTIVE), created_at }
```

### Entidades de Estrutura (dependem de Organization)

```sql
Operation      { id uuid PK, organization_id FK, name, status enum, 
                 health_thresholds jsonb, created_at }

OperationalGroup { id uuid PK, operation_id FK, name, 
                   supervisor_id FK → User NULLABLE, created_at }

UserRole       { id uuid PK, user_id FK, operation_id FK, group_id FK NULLABLE,
                 role enum(ADMIN, SUPERVISOR_A, SUPERVISOR_B, MEMBER),
                 active bool DEFAULT true, created_at }

Delegation     { id uuid PK, delegator_id FK → User, delegatee_id FK → User,
                 operation_id FK, valid_from timestamptz, valid_until timestamptz,
                 revoked_at timestamptz NULLABLE, created_at }

Restriction    { id uuid PK, user_id FK, type enum(6 tipos), 
                 period_start date, period_end date,
                 status enum(ACTIVE, EXPIRED), notes text, created_at }
```

### Entidades de Template (dependem de Operation)

```sql
ShowBook       { id uuid PK, operation_id FK, title, version int DEFAULT 1,
                 status enum(DRAFT, PUBLISHED, ARCHIVED), created_at }

ShowBookRole   { id uuid PK, show_book_id FK, name, minimum_coverage int DEFAULT 1,
                 block_id FK NULLABLE, order int }

ShowBookBlock  { id uuid PK, show_book_id FK, name, order int }

AgendaEvent    { id uuid PK, operation_id FK, show_book_id FK NULLABLE,
                 type enum(SHOW, REHEARSAL, MEETING, WORKSHOP, OTHER),
                 date date, start_time time, end_time time,
                 status enum(DRAFT, CONFIRMED, CHANGED, CANCELLED, COMPLETED),
                 created_at }
```

### Entidades Operacionais (dependem de Operation e Template)

```sql
Scale          { id uuid PK, group_id FK, period_start date, period_end date,
                 status enum(DRAFT, PUBLISHED), published_at timestamptz NULLABLE,
                 published_by FK → User NULLABLE }

ScaleAllocation { id uuid PK, scale_id FK, agenda_event_id FK,
                  show_book_role_id FK NULLABLE, user_id FK,
                  status enum(ALLOCATED, AT_RISK, OPEN),
                  confirmed_at timestamptz NULLABLE }

DailyBook      { id uuid PK, agenda_event_id FK, show_book_id FK,
                 version int DEFAULT 1, status enum(DRAFT, PUBLISHED, OUTDATED, CANCELLED),
                 published_at timestamptz NULLABLE, published_by FK → User NULLABLE }

DailyBookPosition { id uuid PK, daily_book_id FK, show_book_role_id FK,
                    user_id FK NULLABLE,
                    status enum(COVERED, AT_RISK, OPEN) }

-- Regra: DailyBook.version increments on every republish
-- Regra: DailyBook NEVER updated in-place after PUBLISHED — new version only
```

### Entidades de Comunicação

```sql
Request        { id uuid PK, requester_id FK → User, operation_id FK,
                 type enum(7 tipos), status enum(PENDING, APPROVED, DENIED, 
                 ALTERNATIVE_PROPOSED, ALTERNATIVE_ACCEPTED, ALTERNATIVE_REJECTED, EXPIRED),
                 target_dates date[], reason text, created_at }

RequestDecision { id uuid PK, request_id FK, supervisor_id FK → User,
                  decision enum(APPROVED, DENIED, ALTERNATIVE_PROPOSED),
                  reason text NOT NULL CHECK (decision != 'DENIED' OR reason IS NOT NULL),
                  -- Constraint: reason obrigatório para DENIED
                  alternative_details jsonb NULLABLE, deadline timestamptz NULLABLE,
                  created_at }

Notice         { id uuid PK, author_id FK → User, operation_id FK,
                 urgency enum(INFORMATIVE, IMPORTANT, CRITICAL),
                 content text, created_at, cancelled_at timestamptz NULLABLE }

NoticeConfirmation { id uuid PK, notice_id FK, user_id FK, confirmed_at timestamptz }
-- Unique constraint: (notice_id, user_id) — um Membro confirma uma vez

Message        { id uuid PK, sender_id FK → User,
                 recipient_id FK → User NULLABLE, -- NULL = group message
                 group_id FK → OperationalGroup NULLABLE,
                 context_type enum(REQUEST, DELIVERY, NOTICE, MO, DAILY_BOOK, FREE) NULLABLE,
                 context_id uuid NULLABLE, content text, created_at }
-- SEM updated_at — imutabilidade por design de schema

Delivery       { id uuid PK, creator_id FK → User, operation_id FK,
                 type enum(READING, VIDEO, OPERATIONAL_UPDATE, CHECKLIST),
                 title, content jsonb, due_date date, max_due_date date,
                 status enum(DRAFT, PUBLISHED, CANCELLED), created_at }

DeliveryAssignment { id uuid PK, delivery_id FK, user_id FK,
                     status enum(PUBLISHED, RECEIVED, VIEWED, COMPLETED, OVERDUE, EXPIRED),
                     completed_at timestamptz NULLABLE, expired_at timestamptz NULLABLE }
-- Status EXPIRED: never updatable after set — enforced in service layer
```

### Entidades de Rastreamento

```sql
OperationalChange { id uuid PK, -- MO
                    type enum(20+ tipos definidos em mudanca-operacional doc),
                    actor_id FK → User NULLABLE, -- NULL = system
                    actor_type enum(HUMAN, DETERMINISTIC_ENGINE, LLM_CONFIRMED),
                    correlation_id uuid, -- rastreia cadeia de eventos
                    triggered_by_type text, triggered_by_id uuid,
                    affected_entities jsonb, context jsonb, created_at }

HistoryEvent   { id uuid PK, mo_id FK → OperationalChange,
                 entity_type text, entity_id uuid,
                 actor_id FK → User NULLABLE, actor_type enum,
                 action text, before_state jsonb, after_state jsonb,
                 created_at }
-- Sem UPDATE ou DELETE no repositório — enforced by service + DB permissions

Notification   { id uuid PK, user_id FK, type text, priority enum,
                 payload jsonb, device_token text, platform enum(IOS, ANDROID),
                 status enum(PENDING, SENT, DELIVERED, FAILED),
                 retry_count int DEFAULT 0, delivered_at timestamptz NULLABLE,
                 created_at }
```

---

## PARTE 4 — MODELO DE EVENTOS

---

### Cadeia de eventos crítica: aprovação de solicitação de folga

```
Membro cria Solicitação de Folga
    → POST /requests (Solicitações domain)
    → solicitacoes.request.created emitido
        → [AI] dispara impact analysis (CoverageAnalyzer)
        → [Notificações] push para Supervisor: "nova Solicitação aguardando"
    
Supervisor decide: APROVAR
    → POST /requests/:id/decide (Solicitações domain)
    → Validação: RequestDecision não tem required reason para APPROVED
    → solicitacoes.request.approved emitido
        → [MO Engine] cria MO_APROVACAO_FOLGA
            → mo.created emitido (correlationId = requestId)
                → [Histórico] HistoryEvent criado para Request + MO
                → [Escala] ScaleAllocation flagged (posição descoberta)
                    → scale.allocation.changed emitido
                        → [Livro do Dia] se DailyBook existe para a data: dailybook.outdated emitido
                            → [Painel Operacional] exceção adicionada
                → [Notificações] push para Membro: "Solicitação aprovada"
```

**Total de side-effects em um único APROVAR:** 1 MO + 2 HistoryEvents + 1 ScaleAllocation update + 0-1 DailyBook flag + 1 push notification. Tudo via bus de eventos, assíncrono exceto a resposta da API ao Supervisor.

---

### Cadeia de eventos crítica: publicação de Escala

```
Supervisor publica Escala
    → POST /scales/:id/publish (Escala domain)
    → Motor de Regras valida alertas abertos
    → Supervisor confirma explicitamente (body: { confirmedAlerts: true })
    → scale.published emitido com lista de changes[]
        → [MO Engine] cria MO_PUBLICACAO_ESCALA para cada change
            → mo.created emitido por change
                → [Histórico] HistoryEvent por change
        → [Livro do Dia] verifica todos os DailyBooks para datas afetadas
            → dailybook.outdated para cada DailyBook existente
        → [Notificações] push para cada Membro com alocação alterada
```

---

### Efeitos colaterais por evento (resumo)

| Evento | Efeitos colaterais |
|---|---|
| `agenda.event.cancelled` | Aviso Crítico automático · MO_CANCELAMENTO_SHOW · Scale recalculated |
| `scale.published` | MO por change · DailyBooks outdated · Push para membros afetados |
| `solicitacoes.request.approved` | MO · Scale flag · DailyBook flag · Push ao Membro |
| `solicitacoes.request.denied` | HistoryEvent com reason · Push ao Membro |
| `deliveries.assignment.expired` | HistoryEvent imutável · Push ao Supervisor |
| `dailybook.outdated` | Exceção no Painel Operacional · Badge de revisão pendente |
| `mo.created` | HistoryEvent para todas as entidades afetadas |

---

## PARTE 5 — MOTOR DE REGRAS DETERMINÍSTICO

---

### Estrutura do Motor

O motor é um conjunto de serviços puros (sem side effects, sem I/O) — apenas recebem dados e retornam resultados. São chamados pelo domínio correspondente antes de emitir eventos.

```
RulesEngine/
  ├── CoverageRules/
  │     ├── CandidateRanker          → rankedCandidates[]
  │     ├── MinimumCoverageValidator  → { isValid, missingCount }
  │     └── PositionStatusCalculator  → enum(COVERED, AT_RISK, OPEN)
  │
  ├── RestrictionRules/
  │     ├── RestrictionConflictDetector → conflicts[]
  │     └── RestrictionActivePeriodCheck → isActive(userId, date)
  │
  ├── PropagationRules/
  │     ├── CascadeCalculator        → cascadeImpacts[]
  │     ├── MOTriggerDecider         → shouldCreateMO(event) boolean
  │     └── DailyBookOutdateChecker  → shouldOutdate(scaleChange, dailyBook) boolean
  │
  └── PrioritizationRules/
        ├── ExceptionPrioritizer     → prioritizedExceptions[]
        └── RequestPrioritizer       → sortedRequests[]
```

---

### Regras de Cobertura

**CandidateRanker** — dado `(roleId, eventId, excludedUserIds[])`, retorna membros do grupo em ordem:

```
Camada 1: nenhuma restrição ativa no período do evento
Camada 2: nenhuma folga aprovada para o evento
Camada 3: sem conflito de horário (outras alocações no mesmo horário)
Camada 4 (pós-piloto): frequência histórica na função (mais experiência = maior prioridade)

Empate entre camadas: ordem alfabética (determinístico, sem surpresas)
```

**MinimumCoverageValidator** — `(dailyBookId)` → verifica cada `ShowBookRole.minimum_coverage` contra posições alocadas no `DailyBook`.

**PositionStatusCalculator:**
```
allocated_count >= minimum_coverage AND allocated_count > minimum_coverage → COVERED
allocated_count == minimum_coverage → AT_RISK (margem zero)
allocated_count < minimum_coverage → OPEN
```

---

### Regras de Restrição

**RestrictionConflictDetector** — `(userId, date, roleId)` → retorna todas as restrições ativas que conflitam:

```
6 tipos de restrição no MVP:
1. PHYSICAL    → impede papéis com requisitos físicos (ex.: acrobacia)
2. HEALTH      → impede qualquer alocação no período
3. SCHEDULE    → conflito de horário externo
4. ROLE        → incompatível com função específica
5. TECHNICAL   → não treinado para equipamento
6. PERSONAL    → autorizada pelo Admin, escopo genérico
```

**Regra:** restrição ativa = `restriction.status = ACTIVE AND restriction.period_start <= date <= restriction.period_end`.

---

### Regras de Propagação

**CascadeCalculator** — `(proposedChange: { userId, roleId, eventId, action })` → lista de impactos em cascata:

```
Algoritmo:
1. Identifica todos os ScaleAllocations dependentes do userId no mesmo período
2. Para cada posição que fica descoberta, chama CandidateRanker
3. Se CandidateRanker retorna lista vazia para posição crítica → impacto CRÍTICO
4. Se CandidateRanker retorna candidatos → impacto COBERTO_COM_SUBSTITUIÇÃO
5. Retorna lista ordenada por severity (CRÍTICO primeiro)
```

**DailyBookOutdateChecker** — `(scaleChange)`:
```
SE DailyBook existe para eventId da alocação afetada
   E DailyBook.status IN (PUBLISHED, DRAFT)
   ENTÃO retorna shouldOutdate = true, razão = tipo de mudança
```

---

### Regras de Priorização

**ExceptionPrioritizer** — para o Painel Operacional:

```
score(exception) = 
  (1 / minutes_until_event_start) × criticality_weight

criticality_weight:
  position.status == OPEN AND minimum_coverage == 1 → 2.0 (crítico)
  position.status == OPEN AND minimum_coverage > 1  → 1.5
  position.status == AT_RISK                         → 1.0
  dailybook.status == OUTDATED                       → 0.8
  unconfirmed_change approaching event               → 0.6

Retorna lista ordenada por score DESC
```

**RequestPrioritizer** — `(requests[])` → `sorted by impact_date ASC, then created_at ASC` (pedidos com impacto mais próximo primeiro).

---

## PARTE 6 — INTELIGÊNCIA ARTIFICIAL — ESPECIFICAÇÃO TÉCNICA

---

### MVP Piloto (Fases 1–3): Motor Determinístico como "IA"

No piloto, todas as features descritas como "IA" no Blueprint são implementadas pelo Motor de Regras. Não há chamada a LLM. Não há API externa. O produto funciona completamente offline da perspectiva de IA.

**Mapeamento de features MVP → implementação determinística:**

| Feature "IA" no Blueprint | Implementação técnica no MVP |
|---|---|
| Candidatos ranqueados para cobertura | CandidateRanker (regras 3 camadas) |
| Priorização de exceções no Painel | ExceptionPrioritizer (fórmula de score) |
| Análise de impacto de Solicitação | MinimumCoverageValidator + CandidateRanker |
| Simulação de cascata | CascadeCalculator (grafo de dependências) |
| Detecção de posição em risco | PositionStatusCalculator |
| Sugestão de Livro do Dia | Geração automática de proposta (Livro do Show + Escala + Restrições) |

---

### Fase 4: Integração LLM

**Estrutura técnica do LLM:**

```
AIService/
  ├── LLMClient             → wrapper configurável (OpenAI / Anthropic)
  ├── ContextBuilder        → monta contexto operacional para injeção no prompt
  │     ├── MemberContext   → dados do Membro (apenas os seus)
  │     ├── SupervisorContext → dados do Grupo do Supervisor
  │     └── AdminContext    → dados agregados de todas as Operações
  ├── PersonaPrompts        → system prompts por perfil (3 arquivos)
  ├── LLMActionParser       → converte resposta LLM em estrutura tipada
  └── FallbackRouter        → se LLM indisponível → RulesEngine
```

**Contrato de segurança:**
- `LLMClient` nunca chama endpoints mutadores da API interna
- `LLMActionParser` retorna `AIsuggestion` — nunca executa a ação
- A sugestão é apresentada ao usuário como proposta
- O usuário confirma → a ação é executada pelo domínio correto via endpoint normal
- A ação executada é registrada no Histórico como `actor_type: LLM_CONFIRMED`

**Modo degradado:**
```typescript
async function getSuggestion(context: OperationalContext): Promise<Suggestion> {
  try {
    return await llmClient.complete(context)
  } catch (LLMUnavailableError) {
    logger.warn('LLM unavailable — falling back to deterministic engine')
    return rulesEngine.getSuggestion(context) // sempre disponível
  }
}
```

---

## PARTE 7 — API — CONTRATOS PRINCIPAIS

---

**Padrão:** REST + JSON. Autenticação: `Authorization: Bearer <access_token>`. Respostas de erro no padrão RFC 7807 (Problem Details).

### Autenticação

```
POST /auth/login           → { access_token, refresh_token, user, profile }
POST /auth/refresh         → { access_token, refresh_token }
POST /auth/logout          → 204
POST /auth/devices         → registra device token para push
```

### Organização e Estrutura

```
GET  /operations                    → lista Operações do usuário
POST /operations                    → cria Operação (Admin)
GET  /operations/:id/groups         → grupos da Operação
POST /operations/:id/groups         → cria Grupo
POST /operations/:id/groups/:gid/members → adiciona Membro ao Grupo
PUT  /users/:id/role                → altera papel do Membro
POST /users/:id/restrictions        → cria Restrição
POST /delegations                   → cria Delegação temporária
```

### Agenda e Livro do Show

```
GET  /operations/:id/show-books     → lista Livros do Show
POST /operations/:id/show-books     → cria Livro do Show
GET  /operations/:id/agenda         → eventos do calendário
POST /operations/:id/agenda         → cria evento
PUT  /agenda/:id/status             → altera status (CONFIRMED, CANCELLED, etc.)
```

### Escala

```
GET  /groups/:id/scale              → escala do grupo por período
PUT  /scale/:id/allocations         → altera alocações
GET  /scale/:id/coverage-analysis   → análise de cobertura atual
GET  /scale/candidates              → candidatos ranqueados para posição ?roleId&eventId
GET  /scale/cascade-simulation      → simula cascata ?proposedChange
POST /scale/:id/publish             → publica escala (body: { confirmedAlerts: bool })
POST /scale/changes/:id/confirm     → Membro confirma mudança
```

### Livro do Dia

```
POST /agenda/:id/daily-book/generate → gera proposta automática
GET  /agenda/:id/daily-book          → livro do dia atual
PUT  /daily-book/:id                 → edita posições (apenas em DRAFT)
POST /daily-book/:id/publish         → publica (body: { confirmedAlerts: bool })
GET  /daily-book/:id/diff            → delta entre versões
```

### Solicitações

```
POST /requests                       → cria solicitação (Membro)
GET  /operations/:id/requests        → lista para Supervisor (ordenada por impact_date)
GET  /requests/:id/impact-analysis   → análise de impacto automática
POST /requests/:id/decide            → decide (body: { decision, reason?, alternativeDetails? })
POST /requests/:id/respond-alternative → Membro responde proposta alternativa
```

### Comunicação

```
POST /operations/:id/notices         → cria Aviso
GET  /operations/:id/notices         → lista Avisos
POST /notices/:id/confirm            → Membro confirma leitura
GET  /notices/:id/confirmations      → rastreamento por Supervisor

POST /messages                       → cria Mensagem (contextual ou livre)
GET  /messages?contextType&contextId → mensagens de um contexto

POST /deliveries                     → cria Entrega
POST /deliveries/:id/publish         → publica
POST /deliveries/:id/assignments/:uid/complete → Membro conclui
GET  /deliveries/:id/status          → dashboard de estados por Membro
```

### Views Compostas (mobile-first)

```
GET /my-day          → Membro: próxima atividade, mudanças, confirmações pendentes
GET /operational-panel → Supervisor: status, exceções priorizadas, confirmações pendentes
GET /health-panel    → Admin: saúde por Operação
```

### Histórico e IA

```
GET /operations/:id/history         → histórico agrupado por MO
GET /history/entity?type&id         → histórico de uma entidade específica
POST /ai/suggest                    → retorna sugestão (NUNCA executa ação)
```

---

## PARTE 8 — MOBILE E WEB

---

### O que é compartilhado (monorepo)

```
packages/shared/
  ├── types/          → Zod schemas de todas as entidades (fonte única de verdade de tipos)
  ├── api-client/     → cliente HTTP tipado (fetch wrapper com auth automático)
  ├── utils/          → formatação de datas, cálculo de estados, constantes
  └── constants/      → enums, códigos de tipo, limites de validação
```

### O que é específico — Web

Web é utilizado primariamente por **Supervisores e Admin**. Prioriza gestão, visão multi-horizonte e criação de conteúdo.

- Gestão de Escala (grid view complexo por semana/mês)
- Criação e edição de Livro do Dia
- Setup wizard do Admin (Organização → Grupos → Membros → Show)
- Painel de Saúde (analytics)
- Dashboard de Entregas (visão por Membro)
- Gestão de Avisos com rastreamento de confirmações

### O que é específico — Mobile

Mobile é utilizado primariamente por **Membros**. Prioriza consulta rápida e confirmações.

- S-01 Meu Dia (tela primária — abertura automática)
- Confirmação de mudanças de Escala (1 tap)
- Criação de Solicitações (fluxo de 3 telas máximo)
- Consumo de Entregas (leitura, vídeo, checklist)
- Confirmação de Avisos
- Mensagens contextuais

### Estratégia de sincronização

| Método | Aplica a |
|---|---|
| **Polling 60s** | Background refresh do Meu Dia e Painel Operacional |
| **Push notification como trigger** | Atualizações imediatas que exigem ação: mudança de Escala, decisão de Solicitação, Aviso crítico |
| **Optimistic UI** | Confirmações de mudança (marcadas localmente, sincronizadas ao recuperar conectividade) |
| **Offline queue** | Ações tomadas sem conectividade são enfileiradas localmente e sincronizadas ao reconectar |

**Cache local no mobile:** `AsyncStorage` para dados do dia atual (Escala pessoal, próxima atividade, Avisos não confirmados). Invalidado ao receber push notification.

**Regra:** Meu Dia sempre mostra quando foi a última sincronização. Se offline e sem cache, exibe estado explícito — não dado stale silencioso.

---

## PARTE 9 — OBSERVABILIDADE

---

### Logs estruturados

Todos os logs em JSON com campos obrigatórios:

```json
{
  "timestamp": "2026-06-18T14:30:00Z",
  "level": "INFO",
  "request_id": "uuid",
  "correlation_id": "uuid",
  "user_id": "uuid",
  "operation_id": "uuid",
  "domain": "solicitacoes",
  "action": "request.approved",
  "duration_ms": 45
}
```

**Níveis:**
- `ERROR` — alerta imediato (falha de push, erro de banco, exceção não tratada)
- `WARN` — monitorar tendência (retry de push, lentidão de query)
- `INFO` — eventos operacionais relevantes (publicação de Escala, aprovação de Solicitação)
- `DEBUG` — desenvolvimento local apenas — não vai para produção

**Nunca logar:** conteúdo de Mensagens, dados de Solicitação (privacidade), tokens de autenticação.

---

### Auditoria operacional vs. auditoria técnica

**Auditoria operacional** = tabela `HistoryEvent`. É o que qualquer usuário ou processo judicial consultaria. Permanente, imutável, exportável.

**Auditoria técnica** = tabela separada `SecurityAuditLog`:
```sql
SecurityAuditLog { id, actor_id, action enum(LOGIN, LOGOUT, PERMISSION_DENIED, 
                   TOKEN_EXPIRED, INVALID_ACCESS_ATTEMPT), 
                   target_resource, ip_address, created_at }
```

---

### Telemetria de produto (métricas do piloto)

Coletadas automaticamente via eventos do sistema:

| Métrica | Como coletar |
|---|---|
| M1 — Taxa de Escalas publicadas no produto | `scale.published` / total eventos do período |
| M2 — Taxa de confirmações de mudança | `scale.change.confirmed_by_member` / `scale.allocation.changed` |
| M3 — Taxa de Solicitações no produto | `solicitacoes.request.created` / estimated total |
| M4 — Qualidade de decisão | `request.denied` WITH reason / total `request.denied` (deve ser 100%) |
| M5 — Tempo de decisão | `request.approved/denied.timestamp` - `request.created.timestamp` |
| M6 — DAU por perfil | `identity.user.logged_in` GROUP BY role, date |
| M8 — Taxa de renotificação | endpoint de renotificação manual / total Avisos |

---

### Rastreamento de eventos (correlation_id)

Toda cadeia de eventos iniciada por uma ação de usuário usa o mesmo `correlation_id`:

```
POST /requests/:id/decide  →  correlation_id gerado
    → solicitacoes.request.approved  (correlation_id)
    → mo.created                     (correlation_id)
    → scale.allocation.changed       (correlation_id)
    → dailybook.outdated             (correlation_id)
    → notifications.sent             (correlation_id)
```

Isso permite reconstruir toda a cadeia de um `correlation_id` a partir de qualquer ponto — útil para debug de lado-efeito inesperado.

---

## PARTE 10 — VEREDITO

---

### Uma equipe técnica consegue iniciar o Sprint 1 apenas com este documento e os documentos funcionais aprovados?

## 🟢 Sim

Este documento, combinado com o Blueprint Executivo e o Plano MVP Piloto, fornece:

✅ Padrão arquitetural definido (Monólito Modular + NestJS + PostgreSQL + React Native + Expo)
✅ Domínios mapeados com eventos produzidos e consumidos
✅ Schema de banco de dados com PKs, FKs, constraints e regras de imutabilidade
✅ Bus de eventos interno com cadeia de side-effects documentada
✅ Motor de Regras com 4 categorias e algoritmos especificados
✅ Separação clara IA-determinística (MVP) vs. LLM (Fase 4) com modo degradado
✅ Contratos de API (sem endpoints exaustivos — mas cobertura suficiente para Sprint 1)
✅ Split mobile/web com estratégia de sincronização
✅ Estrutura de observabilidade com campos de log, métricas do piloto e rastreamento por correlation_id

**O que fazer no Sprint 0 (antes do Sprint 1):**

1. Criar monorepo pnpm com estrutura `apps/api` + `apps/web` + `apps/mobile` + `packages/shared`
2. Configurar schema de banco de dados v1 (entidades das Partes 3 que são P0)
3. Configurar conta Apple Developer e credenciais FCM/APNs antes que o time de mobile precise delas
4. Revisar o schema de `HistoryEvent` e `OperationalChange` com o Tech Lead — são as entidades mais críticas de acertar na v1

---

*Arquitetura Técnica produzida em 18/06/2026 — MyASA 2.0*
*Monólito Modular · 17 domínios · Bus de eventos interno · Motor determinístico · Pronto para Sprint 1*
