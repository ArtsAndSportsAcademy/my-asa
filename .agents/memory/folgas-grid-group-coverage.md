---
name: Folgas grid — agrupar por grupo e cobertura
description: Como rotular cada membro da grelha de folgas com o seu grupo sem vazar grupos cross-operation
---

Ao juntar o grupo de cada membro na grelha de folgas (GET /folgas/grid), NÃO usar
`operationalGroups.operationId === operationId` como filtro: isso esconde grupos
MULTI/ALL (cujo `operationId` é null). Em vez disso, rotular o membro com o grupo
SÓ se o grupo COBRIR a operação atual, via `groupCoveredOperationIds(group, orgId)`
(OPERATION→dona; MULTI→tabela de cobertura; ALL→todas da org) e verificar
`covered.includes(operationId)`.

**Why:** a ligação membro→grupo vem de `user_roles.groupId` (no role da operação),
mas não há FK composta que garanta consistência operação↔grupo; um groupId a apontar
para grupo de outra operação vazaria o nome/id desse grupo. Filtrar por igualdade de
operationId resolveria o leak mas partiria grupos amplos legítimos.

**How to apply:** sempre que expuser metadados de grupo a partir de `user_roles.groupId`,
validar cobertura com o helper canónico; nunca filtrar `organizationId` no WHERE
(grupos OPERATION legados têm org NULL — ver group-null-org-legacy).

Frontend: `FolgasGrid` recebe `groupBy`; reordena o MESMO array `members` (a seleção
por arraste usa os índices) por groupName (alfabético, "Sem grupo" no fim) e desenha
cabeçalhos de grupo interlaçados (Fragment) — os <tr> de cabeçalho não entram na
lógica de seleção. Toggle "Por grupo" nas páginas admin e supervisor.
