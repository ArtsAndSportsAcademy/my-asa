---
name: Scales — queryKey de folgas
description: useListFolgas precisa de getListFolgasQueryKey explícito, não pode usar apenas { enabled }
---

## Regra
`useListFolgas` requer `queryKey` explícito na opção `query`:
```tsx
const folgasParams = { operationId, dateFrom, dateTo, status: "APPROVED" as any };
const { data } = useListFolgas(folgasParams, {
  query: { queryKey: getListFolgasQueryKey(folgasParams), enabled: !!operationId && !!selectedDay },
});
```

**Why:** O hook gerado pelo orval tem `queryKey` marcado como required em `UseQueryOptions`. Outros hooks como `useListScales` têm o mesmo padrão — sempre passar `getList*QueryKey(params)`.

**How to apply:** Toda vez que usar um hook orval de listagem, sempre importar e usar o `getList*QueryKey` correspondente. Verificar via typecheck se faltou algum.
