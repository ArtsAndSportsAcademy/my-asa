---
name: Responsável do show e permissões destrutivas do Livro do Dia
description: Por que responsibleId deve ser supervisor e por que apagar é gestor-only
---

# Responsável do show TEM de ser supervisor

`canManageShowBook` e `canOperateDailyBook` dão direitos totais a quem casa com
`show_books.responsibleId`. Logo, atribuir um membro/capitão como responsável seria
uma **escalada de privilégio**.

**Regra:** ao definir `responsibleId` (PATCH /show-books/:id/responsible), validar
que esse utilizador tem papel ATIVO `SUPERVISOR_A` ou `SUPERVISOR_B` na operação do
show (`user_roles` com operationId === show.operationId). Caso contrário, 400.

**Why:** o code review apanhou que a rota só verificava existência do utilizador, não
o papel. O gate da rota é `requireRole("ADMIN")` (só admin atribui), mas o ALVO
também tem de ser supervisor da operação.

# Apagar Livro do Dia é gestor-only

`canOperateDailyBook` inclui capitães com delegação (podem gerar/publicar). Apagar é
destrutivo e NÃO deve ser delegável.

**Regra:** DELETE /daily-book/:id usa `requireRole(ADMIN,SUPERVISOR_A,SUPERVISOR_B)` +
gate de gestor-na-operação (ADMIN, ou supervisor cujo operationIds inclui a operação
derivada). Não usar canOperateDailyBook aqui.

# supervisorOperationIds na lista de utilizadores

`GET /users` (attachOperationIds) expõe `supervisorOperationIds` (operações onde o
user é SUPERVISOR_A/B). Usado no web-admin para o seletor de responsável mostrar só
supervisores elegíveis. Campo computado (não coluna) — prod-safe. Schema User no
openapi tem o campo nullable.
