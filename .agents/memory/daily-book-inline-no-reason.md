---
name: Livro do Dia — estilo antigo (sem Motivo obrigatório)
description: Como o Livro do Dia (daily-book / domínio "ln") deixou de exigir Motivo e ganhou swap inline
---

# Livro do Dia — estilo antigo

O domínio do Livro do Dia no codegen/openapi é `daily-book` (operationIds) — NÃO confundir com o Livro do Show. Algumas paths/schemas internos do orval usam prefixo `ln` para outro recurso; o Livro do Dia usa rotas `/daily-book/...`.

**Regra:** publish/republish/cancel do Livro do Dia NÃO exigem `reason` do usuário. O backend usa `req.body.reason?.trim() || DEFAULT_DAY_REASON` (constante em `artifacts/api-server/src/routes/daily-book.ts`) e a auditoria/delta continua gravando.
**Why:** aproximar do MyASA antigo — operador ajusta o dia sem fricção de digitar motivo a cada ação.
**How to apply:** ao mexer nessas rotas, mantenha reason opcional. `CancelDailyBookRequest` no openapi.yaml teve `required: [reason]` REMOVIDO; regenerar com `pnpm --filter @workspace/api-spec run codegen` se mexer.

**Swap inline:** `AssignmentRow` em `admin/daily-book.tsx` NÃO usa mais Dialog para trocar escalado — edição inline (clica no nome ou no ícone → Select inline + Check/X). Mirror do construtor do Livro do Show.

Supervisor republish e admin cancel: textarea de Motivo agora é "(opcional)", botões não ficam mais disabled por reason vazio. Mobile e membro são read-only e não usam reason.
