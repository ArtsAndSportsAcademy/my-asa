---
name: Modelo de papéis no cadastro (MyASA)
description: Quais papéis expor no formulário de cadastro de usuário e como mapeiam para o enum do banco.
---

# Papéis no cadastro de usuário

O cliente entende **3 papéis**: Administrador, Supervisor e Membro / Elenco. NÃO existem dois tipos de supervisor para o usuário final.

**Mapeamento no seletor (web-admin users.tsx ROLE_OPTIONS):**
- Administrador → `ADMIN`
- Supervisor → `SUPERVISOR_A`
- Membro / Elenco → `MEMBER`

**Why:** o banco/JWT têm `SUPERVISOR_A` e `SUPERVISOR_B` (diferença real: A pode montar/editar o Livro do Show como admin; B não). O cliente confirmou que **supervisores devem poder montar o Livro do Show**, então "Supervisor" = `SUPERVISOR_A`. NÃO oferecer "Supervisor Sênior"/`SUPERVISOR_B` no cadastro.
**How to apply:** ao mexer no seletor de papel, manter só as 3 opções. `SUPERVISOR_B` ainda existe no role-gating das rotas (RoleRoute), então não removê-lo do código — apenas não expô-lo no formulário.

Dentro de "Membro/Elenco": a distinção professor/elenco é a *especialização* (campo separado), não o papel. Delegações (membro assumir funções de supervisor em férias/folga) são funcionalidade existente e separada do papel fixo.
