---
name: web-admin fetch — Bearer token obrigatório
description: Como autenticar chamadas fetch() manuais no web-admin contra a API
---

## Regra

Todo `fetch()` manual no web-admin que acesse `/api/...` precisa enviar o token JWT no header `Authorization`:

```ts
function getToken(): string {
  return localStorage.getItem("myasa_access_token") ?? "";
}

fetch("/api/alguma/rota", {
  headers: { Authorization: `Bearer ${getToken()}` },
});
```

**NÃO funciona:** `credentials: "include"` — a API usa `requireAuth` que lê apenas o header Bearer, não cookie de sessão.

**Por quê:** `requireAuth` em `artifacts/api-server/src/middlewares/auth.ts` extrai o token do header `Authorization: Bearer <token>`, não de cookies. O padrão de autenticação é JWT stateless.

## Como aplicar

- Sempre que criar uma nova página/componente com `fetch()` direto (sem os hooks `useXxx` do `@workspace/api-client-react`), incluir `Authorization: Bearer ${getToken()}` nos headers.
- Os hooks gerados pelo orval (`useListUsers`, `useListOperations`, etc.) já injetam o token automaticamente via `custom-fetch.ts` — não precisam de ajuste.
- O padrão `getToken()` já existe em `artifacts/web-admin/src/pages/admin/asa.tsx` como referência.
