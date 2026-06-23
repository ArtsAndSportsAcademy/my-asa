---
name: Modelo de responsável por show + delegação de Livro do Dia
description: Regras de autorização para gerir Livro do Show e operar Livro do Dia (responsável, delegação a capitão, escopo de operação)
---

# Modelo de responsabilidade do Livro do Show / Livro do Dia

Centralizado em `artifacts/api-server/src/lib/show-responsibility.ts`.

- **canManageShowBook(actor, show, showOperationId)** — edição estrutural (renomear/cenas/blocos/posições/linhas/status). ADMIN sempre; se `show.responsibleId` definido → só o responsável (e admin); senão (legado) qualquer gestor QUE PERTENÇA À OPERAÇÃO do show (`actor.operationIds.includes(showOperationId)`).
- **canOperateDailyBook(actor, operationId, show)** — gerar/publicar Livro do Dia. ADMIN sempre; se show tem responsável → o responsável OU capitão com delegação DAILY_BOOK **concedida pelo próprio responsável** (`hasActiveResponsibilityForShow(..., requiredDelegatorId=show.responsibleId)`); senão (legado) gestor da operação OU capitão com delegação ativa nessa operação.

**Why:** sem o vínculo `requiredDelegatorId`, uma delegação ao nível da operação criada por OUTRO supervisor daria acesso a um show alheio (escalada de privilégio). Sem o `operationIds.includes`, o fallback legado seria "qualquer gestor da org", não "da operação".

**How to apply:**
- Ao criar uma rota que mexe na estrutura do show, usar o guard `requireShowManage(req,res)` em show-book.ts (já passa `book.operationId` e `req.user.operationIds`).
- Delegação com showBookId só pode ser criada pelo responsável desse show (validado em delegations.ts POST); operação-wide (showBookId null) qualquer supervisor pode criar, mas não alcança shows com responsável.
- Schema: `show_books.responsible_id` e `delegations.show_book_id` (ambos nullable FK). DB DEV e PROD separados — confirmar colunas em prod após publish.
