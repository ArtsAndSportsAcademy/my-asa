---
name: Seletor de operação por escopo de gestão
description: Como escopar listagens por operação na web-admin usando auth.roles + nomes via useGetOperations
---

Páginas que listam por operação (ex.: Livro do Show, Livro do Dia) derivam a operação de `auth.roles`, não de um contexto global (não existe seletor global).

- `UserRole` traz só `operationId` (sem nome). Para mostrar nomes num seletor, usar `useGetOperations()` (retorna `{operations:[{id,name,...}]}`) e cruzar com os operationIds das roles.
- **Filtrar por papel de GESTÃO** ao montar a lista de operações selecionáveis: `["ADMIN","SUPERVISOR_A","SUPERVISOR_B"]`. Usar todas as roles (incl. MEMBER) abre operações onde o utilizador não é gestor (escalada de privilégio intra-org, já que o gate do show-book é sobretudo no frontend).

**Why:** code review apanhou que incluir roles de MEMBER permitia gerir livros de operações fora do escopo de gestão.

**How to apply:** ao adicionar seletor de operação noutra página, replicar o filtro de MANAGER_ROLES; mostrar o seletor só quando >1 operação; ao trocar de operação, limpar a seleção atual (selectedId) e garantir queryKey == invalidate (`getList...QueryKey({operationId: operationId ?? ""})`).
