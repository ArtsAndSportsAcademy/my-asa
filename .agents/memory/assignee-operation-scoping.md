---
name: Designados (assignees) têm de ser escopados à operação
description: pessoas/grupos atribuídos a qualquer entidade escalável não podem vazar entre operações; validar na escrita E na leitura
---

Qualquer entidade que atribua pessoas/grupos e depois apareça numa escala (atividades recorrentes, e por extensão futuras fontes) tem de garantir que os designados pertencem à operação da entidade — em TRÊS camadas:

1. **Escrita (POST/PATCH):** rejeitar (400) se um `userId` não tiver `user_roles` ativo na operação, ou se um `groupId` não cobrir a operação (via `groupCoveredOperationIds`). A query de grupos DEVE ligar `groupId` à organização (`AND organizationId = ...`), senão abre IDOR cross-org (referenciar grupo de outra org). Se contagem encontrada != solicitada → fora de escopo.
2. **Leitura/merge na escala:** defesa em profundidade — mesmo com dados antigos contaminados, só incluir designado direto se `user_roles(active, operationId=scale.operationId)` o contiver; grupos resolvidos com `loadGroupMembers(groupId, [scale.operationId])` para restringir membros à operação.
3. **Frontend:** filtrar selecionáveis por operação (users por `operationIds.includes(opId)` e `!isAdmin`; grupos por `scope==='ALL' || operationIds.includes(opId)`). O backend continua a ser a autoridade.

**Why:** review architect reprovou (FAIL) por vazamento cross-operation; designados de outra operação apareciam na escala. Validar só na escrita não chega — dados legados exigem defesa na leitura.

**How to apply:** ao criar qualquer nova fonte de "pessoas na escala", replicar as 3 camadas. Admins não fazem parte do elenco escalável (excluir por `isAdmin`).
