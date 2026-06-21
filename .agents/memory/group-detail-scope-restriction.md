---
name: GET group detail — escopo de operação em members E supervisors
description: Ao retornar membros/supervisores no detalhe de grupo, aplicar a MESMA restrição de operação aos dois, senão vaza cross-operation para não-admin
---

No `GET /operational-groups/:id`, para callers NÃO-admin calcula-se uma
restrição de operações (`covered ∩ supervisedOperationIds`). Essa restrição
DEVE ser aplicada tanto a `loadGroupMembers` quanto a `loadGroupSupervisors`.

**Why:** Em grupos amplos (scope MULTI/ALL), retornar a lista completa de
supervisores ignorando a restrição expõe supervisores de operações que o caller
não supervisiona (broken access control). Isso foi pego em code review depois de
a 1ª versão filtrar só `members`.

**How to apply:** Ao adicionar qualquer nova coleção de pessoas ao detalhe do
grupo (members, supervisors, etc.), passe `memberRestriction` (undefined p/
ADMIN = vê tudo) para a função de carregamento. As helpers aceitam
`restrictOperationIds?: string[]` e filtram por `user_roles.operationId`.

Relacionado: rota estática `/operational-groups/eligible-supervisors` precisa
ser registrada ANTES de `/operational-groups/:id` no mesmo router, senão o
Express captura "eligible-supervisors" como `:id`.
