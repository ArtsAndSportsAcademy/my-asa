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
