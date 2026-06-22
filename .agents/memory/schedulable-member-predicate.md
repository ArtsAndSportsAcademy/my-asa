---
name: Membro escalável (Performer) — predicado canónico
description: Onde mora o filtro que oculta admins e membros especiais de escalas/folgas e onde aplicá-lo
---

Regra: só membros comuns (Performers) figuram em escalas e folgas. Quem NÃO é escalável:
- papel ADMIN ativo, OU
- `specialization` preenchida e diferente de `PERFORMER` (Professor/Treinador/etc).

**Predicado canónico** em `lib/db/src/schema/identity.ts` (exportado por `@workspace/db`):
- `isSpecialSpecialization(spec)` — spec preenchida e != PERFORMER
- `isSchedulableMember({ isAdmin, specialization })` — o teste único reutilizável

**Why:** evitar lógica duplicada/divergente; admins e especiais não pertencem ao elenco
mas comparecem para suas próprias atividades (agenda/aulas) — isso é OUTRA feature e NÃO
deve ser alterado. O filtro é de EXIBIÇÃO/SELEÇÃO, nunca apaga dados gravados.

**How to apply:** sempre que listar candidatos/linhas/alocações ou montar a grade de folgas:
- API: coverage-engine.ts (candidatos), line-resolver.ts (linhas do Livro do Show),
  routes/folgas.ts (lista + grid), routes/scales.ts endpoint de allocations (legado gravado).
- Helper de servidor `getNonSchedulableUserIds(userIds)` em
  `artifacts/api-server/src/services/scheduling-eligibility.ts` faz o lookup (specialization +
  ADMIN ativo) e devolve o Set dos NÃO escaláveis — usar para filtrar listas já carregadas.
- web-admin scales.tsx: `members` useMemo exclui `u.isAdmin` e specialization especial.
- listUsers anexa campo extra não-tipado `isAdmin` (como `operationIds`) — ler via cast, sem orval.
- Linhas/células virtuais vindas de `agenda_event_participants` (participantes da agenda) NÃO
  são filtradas — são a aula/atividade legítima, protegida pelo out-of-scope da agenda.
