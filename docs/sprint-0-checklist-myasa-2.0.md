# MyASA 2.0 — Sprint 0: Checklist de Saída

> **Data:** 18/06/2026
> **Critério:** Sprint 1 pode começar sem bloqueios técnicos.

---

## STATUS GERAL

| Bloco | Status | Observação |
|---|---|---|
| Monorepo pnpm | ✅ Pronto | Estrutura existente aproveitada |
| lib/shared (enums, eventos, constantes) | ✅ Pronto | `@workspace/shared` — 3 arquivos |
| Schema de banco v1 | ✅ Aplicado | 15 domínios, 25 tabelas |
| Seed de demonstração | ✅ Executável | `pnpm --filter @workspace/db run seed` |
| Event Bus tipado | ✅ Pronto | `src/lib/event-bus.ts` |
| Correlation ID middleware | ✅ Pronto | `src/middlewares/correlation-id.ts` |
| Logger com domain + requestId | ✅ Pronto | `domainLogger()`, `requestLogger()` |
| HistoryEvent (imutável) | ✅ Schema criado | Sem UPDATE/DELETE no repositório |
| SecurityAuditLog | ✅ Schema criado | Separado de HistoryEvent |
| OperationalChange (MO) | ✅ Schema criado | 15 tipos, correlationId nativo |
| Apple Developer | ⚠️ Manual | Ver seção abaixo |
| APNs (iOS Push) | ⚠️ Manual | Ver seção abaixo |
| Firebase / FCM (Android Push) | ⚠️ Manual | Ver seção abaixo |

---

## O QUE FOI CONSTRUÍDO

### `lib/shared` — Tipos compartilhados

```
lib/shared/src/
  enums.ts      → 20 enums de domínio (UserRole, MOType, AllocationStatus...)
  events.ts     → 45 tipos de eventos com payloads tipados
  constants.ts  → PUSH_MAX_RETRIES, COVERAGE_CRITICALITY_WEIGHT, LOG_DOMAIN...
  index.ts      → barrel export
```

### `lib/db/src/schema/` — 14 arquivos de schema

| Arquivo | Tabelas |
|---|---|
| `identity.ts` | `users` |
| `organization.ts` | `organizations`, `operations`, `operational_groups` |
| `teams.ts` | `user_roles`, `delegations`, `restrictions` |
| `showbook.ts` | `show_books`, `show_book_blocks`, `show_book_roles` |
| `agenda.ts` | `agenda_events` |
| `scale.ts` | `scales`, `scale_allocations` |
| `daily-book.ts` | `daily_books`, `daily_book_positions` |
| `requests.ts` | `requests`, `request_decisions` |
| `communication.ts` | `notices`, `notice_confirmations`, `messages` |
| `deliveries.ts` | `deliveries`, `delivery_assignments` |
| `operational-change.ts` | `operational_changes` |
| `history.ts` | `history_events` |
| `audit.ts` | `security_audit_log` |
| `notifications.ts` | `notifications` |

### `artifacts/api-server/` — Infraestrutura de servidor

```
src/lib/event-bus.ts          → TypedEventBus com tipos de EventPayloadMap
src/lib/logger.ts             → domainLogger(), requestLogger() com correlation ID
src/middlewares/correlation-id.ts → X-Correlation-ID e X-Request-ID em todo request
src/app.ts                    → correlationIdMiddleware registrado antes de pinoHttp
```

---

## BANCO DE DADOS — Schema v1

### Tabelas aplicadas ao PostgreSQL

```sql
-- Rodar para verificar:
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

### Seed de demonstração

```bash
pnpm --filter @workspace/db run seed
```

**Cria:**
- 1 Organização: "Companhia MyASA Demo"
- 1 Operação: "Operação Piloto"
- 1 Grupo: "Grupo Principal"
- 1 Admin + 1 Supervisor + 5 Membros
- 1 Livro do Show com 2 blocos e 4 papéis

**Credenciais de acesso (dev, sem autenticação real no Sprint 0):**
```
admin@myasa.demo
supervisor@myasa.demo
membro01@myasa.demo ... membro05@myasa.demo
```

---

## EVENT BUS — Como usar no Sprint 1

### Emitir um evento

```typescript
import { eventBus } from "../lib/event-bus";

// Em scale.service.ts — após publicar escala:
eventBus.emit("scale.published", {
  scaleId: scale.id,
  groupId: scale.groupId,
  operationId: group.operationId,
  changes: [...],
  timestamp: new Date(),
});
```

### Consumir um evento

```typescript
import { eventBus } from "../lib/event-bus";

// Em mo-engine.service.ts — registrar listener na inicialização:
eventBus.on("scale.published", (payload) => {
  // payload é tipado: payload.scaleId, payload.changes, etc.
  moEngine.handleScalePublished(payload);
});
```

---

## LOGGING — Como usar no Sprint 1

```typescript
import { requestLogger } from "../lib/logger";

// Em um route handler:
router.post("/scales/:id/publish", async (req, res) => {
  const log = requestLogger("scale", req.requestId, req.correlationId);
  
  log.info({ scaleId: req.params.id }, "Iniciando publicação de escala");
  
  // ... lógica ...
  
  log.info({ scaleId: req.params.id, changesCount: changes.length }, "Escala publicada");
});
```

**Campos obrigatórios em todos os logs:**
- `domain` — via `domainLogger()` ou `requestLogger()`
- `requestId` — via `req.requestId`
- `correlationId` — via `req.correlationId` — propague para eventos

---

## ⚠️ AÇÕES MANUAIS — Obrigatórias antes do Sprint 3 (Push Notifications)

Estas ações exigem acesso humano a contas externas. Não são bloqueadoras para Sprint 1 e Sprint 2.

### Apple Developer Account (iOS Push)

**Responsável:** Product Owner / CTO
**Prazo:** Antes do Sprint 3 (semana 7)

1. Acessar [developer.apple.com](https://developer.apple.com)
2. Criar App ID com capability "Push Notifications"
3. Gerar APNs Authentication Key (`.p8`)
   - Guardar `Key ID`, `Team ID`, e arquivo `.p8`
4. Adicionar como segredos no ambiente:
   - `APNS_KEY_ID`
   - `APNS_TEAM_ID`
   - `APNS_PRIVATE_KEY` (conteúdo do .p8)
5. Bundle ID do app: `com.myasa.app` (confirmar com time de mobile)

### Firebase Cloud Messaging (Android Push)

**Responsável:** Product Owner / CTO
**Prazo:** Antes do Sprint 3 (semana 7)

1. Acessar [console.firebase.google.com](https://console.firebase.google.com)
2. Criar projeto "MyASA"
3. Adicionar aplicativo Android com package: `com.myasa.app`
4. Baixar `google-services.json` → entregar ao time de mobile
5. Gerar Service Account key (para o backend enviar push via Admin SDK)
6. Adicionar como segredo no ambiente:
   - `FCM_SERVICE_ACCOUNT_JSON` (conteúdo do service account JSON)

### Expo Push Notifications (abstração recomendada)

Em vez de integrar APNs e FCM diretamente, usar **Expo Push Service** como camada unificada:

- O app mobile usa `expo-notifications` para registrar device token
- O backend envia push via `https://exp.host/--/api/v2/push/send`
- Sem necessidade de gerenciar APNs e FCM diretamente no backend
- **Recomendado para o piloto** — menos configuração, mesma funcionalidade

Configuração necessária:
```bash
# No app mobile (Sprint 3):
pnpm add expo-notifications
```

```typescript
// Backend (Sprint 3) — enviar push via Expo:
const response = await fetch("https://exp.host/--/api/v2/push/send", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    to: expoPushToken,
    title: "MyASA",
    body: "Escala publicada",
    data: { type: "SCALE_PUBLISHED", scaleId: "..." },
  }),
});
```

---

## CRITÉRIOS DE SAÍDA — Verificação final

| Critério | Como verificar | Status |
|---|---|---|
| Schema no banco | `SELECT count(*) FROM information_schema.tables WHERE table_schema='public'` → 25+ tabelas | ✅ |
| Tipos compartilhados compilando | `pnpm run typecheck:libs` → sem erros | ✅ |
| API server compilando | `pnpm --filter @workspace/api-server run typecheck` → sem erros | ✅ |
| EventBus tipado disponível | `import { eventBus } from "../lib/event-bus"` | ✅ |
| Correlation ID em requests | `req.correlationId` e `req.requestId` disponíveis em qualquer handler | ✅ |
| Seed executável | `pnpm --filter @workspace/db run seed` | ✅ |
| Apple Developer / APNs | Conta criada, Key `.p8` gerada | ⚠️ Sprint 3 |
| Firebase / FCM | Projeto criado, `google-services.json` gerado | ⚠️ Sprint 3 |

---

## PRÓXIMO PASSO — Sprint 1

**Sprint 1 pode começar imediatamente.**

Foco do Sprint 1 (conforme Plano MVP Piloto):
- Autenticação JWT (login, refresh, logout)
- CRUD de Organização → Operação → Grupo → Membro
- Atribuição de papéis
- Estrutura base do Livro do Show

Primeiro arquivo a criar no Sprint 1:
```
artifacts/api-server/src/routes/auth.ts
```

---

*Sprint 0 concluído em 18/06/2026 — MyASA 2.0*
