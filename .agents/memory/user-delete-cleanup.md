---
name: Exclusão de utilizador — limpeza FK
description: Como o DELETE /users/:id evita 409 sem destruir dados partilhados
---

# Exclusão de utilizador (DELETE /users/:id)

Apagar um utilizador falha com 23503 (409) porque ~50 tabelas referenciam `users.id`.
A regra de produto é: **apagar a pessoa e a sua participação pessoal/incidental, mas
NUNCA destruir dados de TRABALHO partilhados de outras pessoas** (escalas, tarefas,
folgas, livros, avisos em si, etc.).

**Como aplicar (dentro de UMA transação, ordem FK-segura, user apagado por último):**
1. Apagar registos pessoais/incidentais NÃO-cascade que se acumulam só por existir e
   navegar na app: `user_roles`, `refresh_tokens`, `device_tokens`, `notifications`,
   `user_notifications`, `library_views`, `message_thread_participants`,
   `notice_recipients`/`notice_confirmations`/`notice_escalations(recipientId)` (avisos
   RECEBIDOS = participação pessoal).
2. Colunas de ATOR **anuláveis** em registos de auditoria/histórico → `SET NULL`
   (preserva o registo, remove só a atribuição): `security_audit_log.actorId`,
   `history_events.actorId`, `history_narratives.createdBy`,
   `operational_changes.actorId`, `notice_escalations.escalatedBy`.
3. Tabelas com `onDelete: cascade` (agenda_event_participants, asa_user_preferences,
   asa_audit_log, recognitions.userId, conversations.participantId, asa_memories.createdBy)
   limpam-se sozinhas ao apagar o user — NÃO listar.
4. Se sobrar FK de dados de TRABALHO reais (NOT NULL `createdBy`/`assigneeId`/`userId`
   noutras tabelas), o Postgres lança 23503, a transação reverte tudo e devolvemos 409
   a sugerir "Desativar".

**Why:** prod NÃO corre migrações drizzle (Publish só adiciona colunas anuláveis), logo
não dá para tornar as colunas de ator NOT NULL anuláveis nem usar reassign via schema.
A via segura sem mudar esquema é apagar o pessoal + NULL no anulável + 409 como
salvaguarda para o resto. Cobre o caso comum (conta de TESTE criada só para ver a versão
supervisor) sem risco de apagar horários/dados de outros membros.
