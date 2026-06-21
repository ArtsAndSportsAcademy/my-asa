---
name: Modelo de escopo de grupos (OPERATION/MULTI/ALL)
description: Como funcionam grupos da operação vs grupos amplos, cobertura de operações e quem gere cada um
---

# Grupos: dois tipos por escopo

`operational_groups.scope` = `group_scope` enum (`OPERATION` | `MULTI` | `ALL`, default `OPERATION`). `operational_groups.operation_id` é NULLABLE (só preenchido em `OPERATION`). Tabela `group_operations` (groupId, operationId) lista as operações cobertas por grupos `MULTI`.

## Cobertura de operações de um grupo
- `OPERATION` → `[operation_id]`
- `MULTI` → linhas em `group_operations`
- `ALL` → todas as operações da org

**Regra:** essa cobertura tem que ser idêntica em dois lugares — `groupCoveredOperationIds` (groups.ts, API) e `groupCoverageOps` (asa.ts, ASA). Se mudar um, mude o outro.

## Quem gere
- ADMIN: cria/edita qualquer escopo.
- SUPERVISOR: só `OPERATION` e só da própria operação. "Operação supervisionada" vem de `user_roles` com role SUPERVISOR_A/B via query (`supervisedOperationIds`), NÃO do JWT `operationIds` (que mistura todos os papéis).

## Membership
Continua em `user_roles` (role=MEMBER, groupId, operationId). Para grupo amplo, o membro DEVE pertencer a uma operação coberta — sem fallback para "qualquer operação do usuário". Caso contrário → 422.

**Why:** permitir adicionar membro fora da cobertura quebra a coerência (grupo MULTI com gente de operação não coberta) e contamina a montagem de escala.

## ASA — consultar_grupo
Resolve grupo por nome (reusa `normalizeName`), filtra grupos que cobrem `ctx.operationId`, e ao listar membros filtra por `user_roles.operationId === ctx.operationId` quando há operação atual — para não trazer membros de outra operação ao montar escala da operação corrente. Depois usa `criar_entradas_escala_lote` (um por membro), nunca um a um.
