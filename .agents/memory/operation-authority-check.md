---
name: Autoridade por operação ≠ operationIds do token
description: Por que verificar papel-na-operação na BD em vez de actor.operationIds.includes(opId)
---

# Autoridade de gestor/supervisor por operação

**Regra:** para autorizar ações de gestão/delegação escopadas a uma operação,
NUNCA usar `actor.operationIds.includes(operationId)` nem `MANAGER_ROLES.has(actor.role)`
isoladamente. Verificar na BD um papel SUPERVISOR_A/B ATIVO na operação EXATA
(tabela `user_roles`). Usar `isSupervisorOfOperation` / `isOperationManager` em
`artifacts/api-server/src/lib/show-responsibility.ts`.

**Why:** o JWT agrega em `operationIds` TODAS as operações de TODOS os papéis
ativos do utilizador (inclui operações onde ele é só MEMBER), e `actor.role` é um
único papel PRIMÁRIO. Logo um supervisor da op A que também é membro da op B
passava num check baseado em operationIds+role e conseguia gerir/delegar na op B —
escalada de privilégio cross-operation. (`ADMIN` continua a ser global e pode
curto-circuitar no topo das funções.)

**How to apply:** qualquer endpoint novo que conceda poderes de gestor por
operação (gerir Livro do Show sem responsável, gerar/publicar/apagar Livro do Dia
no caminho legado, criar delegação por operação inteira com showBookId null) tem
de passar pela verificação na BD. Leitura por MEMBER (ver shows/livros publicados
da própria operação) pode continuar a usar operationIds — é pertença legítima, não
autoridade. Regressão coberta em tests/daily-book-fill.test.ts caso (e).
