---
name: typecheck validation scope
description: Why the named `typecheck` validation covers libs+api-server+mobile but not web-admin/mockup-sandbox
---

# Escopo da verificação `typecheck`

A validação nomeada `typecheck` cobre apenas os pacotes que passam hoje (libs + api-server + mobile). NÃO inclui web-admin nem mockup-sandbox.

**Why:** web-admin e mockup-sandbox têm erros de tipo de biblioteca pré-existentes/acordados (shadcn/react-day-picker em React 19 — duplicação de `@types/react`, "Two different types with this name exist") mais um bug real em web-admin. A validação precisa PASSAR no estado atual; incluí-los a quebraria sempre.

**How to apply:** Para cobertura total, primeiro resolver a duplicação de `@types/react` (dedup pnpm) e os erros do web-admin, depois trocar o comando da validação pelo `pnpm run typecheck` da raiz (cobre tudo). Esse mesmo comando raiz é parte do `pnpm run build`, então o build fica quebrado enquanto esses erros existirem.
