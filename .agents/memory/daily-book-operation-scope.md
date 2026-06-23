---
name: Escopo de operação na LEITURA do Livro do Dia
description: Como/por que os GETs de daily-book são escopados por operação sem coluna operationId
---

# Livro do Dia — escopo por operação na leitura

`daily_books` NÃO tem `operationId`. A operação é sempre derivável por join
`daily_books.agendaEventId → agenda_events.operationId → operations`. `show_books`
também tem `operationId` (NOT NULL), mas o canónico para o Livro do Dia é via evento.

**Regra de leitura** (helper `canViewDailyBook` em `lib/show-responsibility.ts`):
- ADMIN: tudo;
- SUPERVISOR_A/B: livros das suas `operationIds` (qualquer estado);
- Membro: só PUBLISHED/REPUBLISHED da sua operação (leitura);
- Capitão delegado: rascunho do show delegado — reaproveita `canOperateDailyBook`
  (não duplicar a lógica de delegação).

**Why:** os GETs `/daily-book` (lista) e `/daily-book/:id` (+`/delta`) vazavam TODOS
os livros da org sem filtro de operação nem papel. Isto resolve o ponto que o code
review de delegação tinha levantado.

**How to apply:** qualquer NOVO endpoint de LEITURA de Livro do Dia deve passar pelo
helper `resolveDailyBookReadContext(actor, book)` em `routes/daily-book.ts` (reúne
derivação operação→organização + `canViewDailyBook` + escopo de org num só sítio) e
retornar 403 quando `!ctx.ok`. As escritas já usam `requireRole(ADMIN,SUPERVISOR_A,
SUPERVISOR_B)` + `canOperateDailyBook`.

A resposta da lista/detalhe agora inclui `operationId/operationName/eventTitle/
eventDate/showTitle` (campos nullable no schema DailyBook do openapi.yaml; orval gera).
UI (mobile + 3 páginas web-admin) agrupa por operação via util partilhado
`web-admin/src/lib/daily-book-grouping.ts` e rotula com `showTitle || eventTitle`.
