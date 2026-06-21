---
name: Livro do Dia — pessoa única por cena
description: Regra de negócio: a mesma pessoa não pode ocupar 2 posições na MESMA cena ao gerar/regenerar
---

# Livro do Dia: não duplicar pessoa na mesma cena

**Regra de negócio:** ao gerar/regenerar o Livro do Dia, a mesma pessoa não pode ocupar duas posições dentro da MESMA cena (pode em cenas diferentes). A segunda ocorrência vira buraco OPEN (userId null), preservando o lugar como visível para o gestor preencher com outra pessoa.

**Why:** a usuária pediu explicitamente (jun/2026) — o auto-resolver escolhia a mesma pessoa para vários papéis da mesma cena, gerando linhas duplicadas no livro.

**How to apply:**
- Hierarquia: cena → bloco → papel(posição) → assignment(userId). O sceneId de um papel obtém-se por `block.sceneId` (block do showbook), via `role.blockId`.
- Implementado em `artifacts/api-server/src/routes/daily-book.ts`: `dedupAssignmentsForScene(planned, Set<userId>)` aplicado dentro de `createAssignmentsForRole`, que mantém um `Map<sceneId, Set<userId>>` por geração.
- Aplicar nos DOIS fluxos: `POST /daily-book/generate` e `POST /daily-book/:id/regenerate`. Esquecer um deles deixa a regra inconsistente.
- Papel sem bloco/cena (sceneKey null) → não deduplica (não pertence a nenhuma cena).
- Os papéis são lidos com `orderBy(showBookRolesTable.order, id)` para que seja sempre o mesmo lugar a ficar ASSIGNED vs OPEN (determinismo).
- ATENÇÃO: a regra vale só na geração. A edição manual (PATCH de assignment) ainda permite duplicar; se a regra passar a ser global, validar também aí.
