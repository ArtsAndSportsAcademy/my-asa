---
name: Apagar Livro do Show — FKs sem cascade
description: Como apagar com segurança um show_book; ordem de deleção e referências que bloqueiam
---

# Apagar um Livro do Show (show_books)

**Regra:** apagar um `show_books` exige (a) bloquear se estiver referenciado e (b) apagar os filhos manualmente em ordem dentro de uma transação. Não há `onDelete: cascade` na maioria das FKs.

**Why:** em `lib/db/src/schema/showbook.ts`, os filhos (`show_book_scenes`, `show_book_blocks`, `show_book_roles`, `show_book_lines`, `show_book_versions`) referenciam o livro/role SEM cascade. Só `show_book_position_library_refs` tem `onDelete: cascade` (positionId e showBookId). Além disso, `scales`, `agenda_events` e `daily_books` têm `showBookId` (nullable, sem cascade) → um DELETE direto rebenta com violação de FK ou (pior) corromperia dados operacionais.

**How to apply:**
- Antes de apagar: verificar referências em `scales`/`agenda_events`/`daily_books`; se houver, devolver 409 e sugerir arquivar (não anular silenciosamente as ligações).
- `show_book_lines.positionId` → `show_book_roles.id` (sem cascade) → apagar lines ANTES dos roles. Apagar roles cascateia os refs.
- Ordem na transação: lines (via positionIds dos roles do livro) → roles → blocks → scenes → versions → book.
- Authz: é ação destrutiva permanente → `requireRole("ADMIN")` no backend e gate só-ADMIN na UI (atenção: `isAdmin` no web-admin inclui SUPERVISOR_A; criar um `isFullAdmin` separado). Validar escopo de org: join `operations` com `organizationId = req.user.organizationId`, senão 404.

# Apagar uma POSIÇÃO/linha individual (não o livro inteiro)

**Contexto:** na UI do web-admin "Linha" = POSIÇÃO/papel (handler deletePosition mostra toast "Linha removida"). Apagar uma posição falhava porque três FKs apontam para `show_book_roles` SEM cascade: `show_book_lines.positionId`, `scale_allocations.positionId`, `allocation_exceptions.positionId` (só `show_book_position_library_refs` é cascade). Como quase toda posição tem linhas, o DELETE sempre violava FK.

**Regra:** para apagar posições use o helper `purgePositions(tx, positionIds)` em show-book.ts: apaga `show_book_lines`, faz `SET NULL` em `scale_allocations`/`allocation_exceptions` (preserva histórico de escala), e só então apaga `show_book_roles`. Tudo em transação. As rotas DELETE de cena→blocos→posições e bloco→posições reutilizam esse helper.
**Why:** `SET NULL` em vez de apagar nas escalas porque o histórico operacional não deve sumir ao reorganizar a estrutura do livro.

**Regra de ownership (IDOR):** TODA rota mutating aninhada de show-book DEVE validar que o recurso pertence ao `:id` (showBookId) da URL ANTES de mutar, retornando 404 se não pertencer. Helpers: `positionInShowBook(positionId, showBookId)` e `lineInShowBook(lineId, showBookId)` (este via innerJoin linha→posição→showBookId). Aplicar em: deletes (cena/bloco/posição/linha/ref), POST de linhas/refs (valida positionId), e POSTs de criação com FK aninhada — POST blocks valida `sceneId`, POST positions valida `blockId` — todos com `(id=X AND showBookId=:id)`.
**Why:** sem isso, um ID válido de OUTRO livro (mesma org) permite apagar/alterar/criar vínculos cruzados — broken access control. O architect reprova a task por isso; é fácil esquecer ao adicionar rotas novas.
