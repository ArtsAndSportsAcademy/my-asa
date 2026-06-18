---
name: Vite Fast Refresh — Auth Context split
description: Estrutura obrigatória de 3 arquivos para AuthContext no web-admin evitar crash de HMR no Vite
---

# Regra

Vite Fast Refresh exige que cada arquivo exporte **somente componentes React** ou **somente não-componentes**. Exportação mista causa `Could not Fast Refresh ("X" export is incompatible)` e quebra o estado de módulo durante HMR.

# Estrutura correta (3 arquivos)

| Arquivo | Exporta | Tipo |
|---|---|---|
| `contexts/authContext.ts` | `AuthContext` (createContext), `AuthContextType` | não-componente — Fast Refresh ✅ |
| `contexts/AuthContext.tsx` | `AuthProvider` (componente) | componente puro — Fast Refresh ✅ |
| `hooks/useAuth.ts` | `useAuth` (hook) | hook puro — Fast Refresh ✅ |

`AuthContext.tsx` importa `AuthContext` de `./authContext` (arquivo irmão, sem extensão tsx).
`hooks/useAuth.ts` importa `AuthContext` de `@/contexts/authContext`.

**Why:** o arquivo original exportava `AuthContext` (objeto uppercase não-componente) + `AuthProvider` (componente) no mesmo `.tsx`, causando crash de HMR repetido toda vez que o arquivo era editado.

**How to apply:** ao criar qualquer novo contexto React no web-admin, seguir este padrão de 3 arquivos desde o início. `// @refresh reset` NÃO resolve exportação mista — só muda de partial HMR para full remount, mas o erro de incompatibilidade ainda ocorre.
