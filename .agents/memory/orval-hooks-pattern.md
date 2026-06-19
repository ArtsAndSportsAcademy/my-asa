---
name: Orval hooks apagados — padrão de correção
description: Quando orval regenera api.ts, hooks de sprints anteriores são apagados. Padrão para recriar manualmente.
---

## Regra
Cada vez que orval roda (`pnpm codegen`), ele sobrescreve `lib/api-client-react/src/generated/api.ts` e apaga qualquer hook que não tenha um endpoint correspondente na especificação OpenAPI atual. Hooks criados manualmente para funcionalidades antigas somem.

**Why:** orval gera o arquivo inteiro do zero a cada execução.

## Padrão de correção
1. Identificar hooks faltantes rodando `pnpm --filter @workspace/web-admin exec tsc --noEmit` e filtrando por `error TS2305` (missing export).
2. Para cada grupo de hooks faltantes, criar um arquivo manual em `lib/api-client-react/src/<domínio>-manual.ts` usando `useQuery`/`useMutation` do `@tanstack/react-query` + `customFetch` de `./custom-fetch`.
3. Adicionar `export * from "./<domínio>-manual"` ao `lib/api-client-react/src/index.ts`.
4. Rodar `pnpm --filter @workspace/api-client-react exec tsc -p tsconfig.json` para rebuild.
5. Reiniciar o workflow web-admin.

## Arquivos manuais criados até Sprint 18.1
- `check-ins.ts` — useGetCheckInSummary, useStartCheckIn, useEndCheckIn, getGetCheckInSummaryQueryKey
- `requests-manual.ts` — useListRequests, useListPendingRequests, useDecideRequest, tipos RequestItem/RequestDecisionType/DecideRequestInput
- `delegations-manual.ts` — useListDelegations, useCreateDelegation, useCancelDelegation, getListDelegationsQueryKey, tipo DelegationItem

## Shapes importantes
- `useDecideRequest(options?)` aceita `{ mutation?: UseMutationOptions<...> }` (chave `mutation`), não opções diretas
- `DelegationItem.id` (não `delegationId`), `DelegationItem.delegateeName` (não `delegateName`)
- `RequestDecisionType` inclui `"ALTERNATIVE_PROPOSED"` além de `"APPROVED" | "DENIED" | "ALTERNATIVE"`
