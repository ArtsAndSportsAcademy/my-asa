---
name: Pessoa em várias operações
description: Como uma pessoa pertence a mais de uma operação no MyASA e onde se gere
---

# Pessoa pode pertencer a várias operações

O modelo `user_roles` já suporta uma pessoa em múltiplas operações: uma linha por
(operationId, role). Não é preciso mudar schema para isto.

**Por quê:** a utilizadora precisava de pôr membros de uma operação em grupos
operacionais de OUTRA operação. Grupos OPERATION só aceitam quem tem papel ativo
nessa operação (422 em addGroupMemberCore). A solução é dar à pessoa um papel
adicional na operação de destino — não inventar partilha cross-operation.

**Como aplicar:**
- Gerir os vínculos no diálogo de edição da página de Usuários (admin): lista os
  papéis ativos e permite adicionar/remover operação+papel.
- Backend de papéis é ADMIN-only; dedup por (operationId, role); protege o último
  admin ativo da org; 409 em duplicado.
- O cadastro inicial continua a atribuir só UMA operação; operações extra são
  acrescentadas depois na edição.
