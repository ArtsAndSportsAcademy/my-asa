---
name: Duas tabelas de notificação (push vs semântica)
description: MyASA tem dois sistemas de notificação distintos; saber qual usar
---

## Duas tabelas distintas

1. **`notifications`** (`notificationsTable`) — camada de ENTREGA push (FCM/APNS). Colunas: payload jsonb, device_token, platform, status, retry_count. NÃO tem title/message/category/read_at.

2. **`user_notifications`** (`userNotificationsTable`) — camada SEMÂNTICA (sino/badge in-app). Colunas: type, title, message, priority, category, entity_type, entity_id, action_url, read_at. É daqui que o `notificationService` (`createNotification`, `getUnreadCount`, `getUserNotifications`, `notifyMany`) lê e escreve, e é o que alimenta o sino no web e mobile.

**Para notificar um usuário in-app** (badge + lista), use `createNotification`/`notifyMany` do `notificationService.ts` → grava em `user_notifications`. NÃO use `notificationsTable` para isso.

## Armadilha: user_notifications pode não estar migrada

A tabela `user_notifications` e seus enums (`user_notification_priority`, `user_notification_category`) existiam no schema (`lib/db/src/schema/notifications.ts`) mas NÃO no banco — `createNotification` falhava com "relation does not exist". Como as chamadas costumam estar em try/catch best-effort, a falha passa silenciosa (reconhecimento criado, mas sem notificação).

**Como aplicar:** ao usar `createNotification` pela primeira vez num ambiente, confirmar que `user_notifications` existe (`\dt user_notifications`). Se não, criar via SQL (drizzle push falha em non-TTY): CREATE TYPE dos 2 enums + CREATE TABLE. Categoria válida inclui apenas: schedule, book, notice, approval, absence, rehearsal, responsibility, message, system (não há "recognition" — usar "system").
