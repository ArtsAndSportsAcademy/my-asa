---
name: Schema collision — delegationsTable em teams.ts
description: O teams.ts tinha um delegationsTable obsoleto com colunas diferentes do GOV-D11. Foi removido para eliminar conflito de nomes.
---

## Situação

`lib/db/src/schema/teams.ts` continha um `delegationsTable` antigo com colunas:
- `delegatorId`, `delegateeId`, `validFrom` (timestamp), `validUntil` (timestamp), `revokedAt`

O GOV-D11 criou `lib/db/src/schema/delegations.ts` com o novo `delegationsTable`:
- `organizationId`, `supervisorId`, `delegateId`, `operationId`, `startDate` (date string), `endDate` (date string), `reason`, `status` (enum)

Ambos usavam o mesmo nome TypeScript `delegationsTable` e o mesmo nome de tabela PostgreSQL `delegations`, causando colisão no `export *` do schema/index.ts.

## Resolução

Removido o `delegationsTable` e tipos relacionados (`insertDelegationSchema`, `InsertDelegation`, `Delegation`) de `teams.ts`. O canônico agora é `lib/db/src/schema/delegations.ts`.

**Why:** O teams.ts delegationsTable não era usado em nenhum código da aplicação — era um placeholder de sprint anterior. O GOV-D11 é a implementação real.

**How to apply:** Se aparecer erro TypeScript "property X does not exist... Did you mean Y?" para delegationsTable, verificar se há outra definição de delegationsTable em teams.ts ou outro arquivo de schema.
