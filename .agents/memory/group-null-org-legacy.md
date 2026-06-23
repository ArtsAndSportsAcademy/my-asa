---
name: Grupos legados com organization_id NULL
description: validação de designados/escopo de grupo não pode filtrar por organizationId no WHERE — grupos OPERATION antigos têm org NULL
---

`operational_groups.organization_id` é **nullable** (lib/db/src/schema/organization.ts). Em PROD, grupos com scope OPERATION criados antes de a coluna ser povoada têm `organization_id` NULL (só MULTI/ALL recentes, ex.: STAFF, têm org). Dados antigos NÃO são corrigidos por Publish (aplica só diff de esquema, não migra/backfill dados).

**Sintoma:** qualquer validação que faça `eq(operationalGroupsTable.organizationId, organizationId)` no WHERE e depois compare `groups.length !== groupIds.length` rejeita silenciosamente esses grupos → "fora de escopo"/404. Foi o que partia a criação de atividade recorrente COM grupos (POST /api/activities dava 400; pessoas-só dava 201).

**Padrão correto (igual a loadGroupInOrg em groups.ts):** buscar grupo SÓ por id; bloquear apenas org EXPLICITAMENTE diferente (`g.organizationId && g.organizationId !== organizationId`); a amarração real vem da cobertura (`groupCoveredOperationIds(g).includes(operationId)`), e operationId já é validado como operação gerível do admin (logo da sua org). Org NULL é tolerada.

**Why:** dados legados sem org + Publish não-migratório tornam o filtro por org no WHERE uma armadilha. A cobertura por operação já garante o vínculo correto sem vazar entre orgs (OPERATION/MULTI ficam amarrados; ALL usa a org passada).

**How to apply:** ao validar grupos em qualquer rota nova, NUNCA exigir org no WHERE; usar a tolerância acima.

## Cuidado de segurança (revisão)
Tolerar org NULL "na mão" (só bloquear org explicitamente diferente + confiar na cobertura) ABRE IDOR cross-org para scope ALL: `groupCoveredOperationIds(ALL)` usa a org do CALLER, então um grupo ALL de outra org com org NULL seria aceite em qualquer org. Solução canónica: reutilizar `loadGroupInOrg(id, org)` por grupo — tolera NULL só para OPERATION (valida operação∈org) e REJEITA ALL/MULTI sem org. Depois ainda checar `groupCoveredOperationIds(g).includes(operationId)`.
