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

## Visão de membros no detalhe do grupo (anti-vazamento)
No GET de detalhe do grupo, a lista de membros tem que ser filtrada por escopo para NÃO-admin: supervisor/membro só pode ver membros das operações que supervisiona (interseção entre cobertura do grupo e operações supervisionadas). Só ADMIN vê todos.

**Why:** em grupo amplo (MULTI/ALL), devolver todos os membros expõe gente de outra operação a um supervisor de uma operação coberta — vazamento cross-operation. Vale para qualquer endpoint que liste membros de grupo amplo.

## Cores compartilhados HTTP + ASA (anti-drift)
`groups.ts` expõe cores reutilizáveis (`createGroupCore`/`renameGroupCore`/`setGroupStatusCore`/`addGroupMemberCore`/`removeGroupMemberCore`) com `GroupActionError(status,code,message)`. Tanto as rotas HTTP quanto as ferramentas ASA (criar/editar/remover grupo e membros) chamam o MESMO core, montando um `GroupActor={role,userId,organizationId}`. HTTP mapeia `GroupActionError→res.status`; ASA mapeia `→ {error: msg}`.

**Why:** ter a regra de permissão/escopo num só lugar evita que a ASA contorne validações ou divirja do HTTP. Ator vem sempre de `ctx`/`req.user` → ASA não pode escalar papel.
**How to apply:** ao mudar regra de grupo, edite o core (não o handler). ASA `editar_grupo` só chama `renameGroupCore` se `input.name` truthy; `renameGroupCore` tolera name vazio (no-op) para manter o 200 antigo do PATCH. `remover_grupo` = `setGroupStatusCore(...,"ARCHIVED")`. Supervisor criando via ASA usa `ctx.operationId` como operationId.

## ASA — consultar_grupo
Resolve grupo por nome (reusa `normalizeName`), filtra grupos que cobrem `ctx.operationId`, e ao listar membros filtra por `user_roles.operationId === ctx.operationId` quando há operação atual — para não trazer membros de outra operação ao montar escala da operação corrente. Depois usa `criar_entradas_escala_lote` (um por membro), nunca um a um.
