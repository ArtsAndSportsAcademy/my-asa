---
name: Escala — merge do Livro do Dia em tempo de leitura
description: Como o cast do Livro do Dia aparece na escala sem gravar nem mudar esquema, e os filtros obrigatórios
---

# Escala auto-montada — Fase 1 (Livro do Dia → Escala)

O endpoint `GET /api/scales/:id/allocations` compõe a escala em TEMPO DE LEITURA,
juntando 3 fontes: alocações reais (`scale_allocations`), participantes da agenda
(virtuais, prefixo de id `agp:`, `isAgendaParticipant=true`) e agora o cast do
Livro do Dia (virtuais, prefixo `db:`, `isDailyBookParticipant=true`).

**Why:** dev e prod têm bancos separados e o deploy não corre migrações; a regra do
projeto é compor na leitura (sem cópia/sync, sem DDL) para ser prod-safe. É o mesmo
padrão já usado para os participantes da agenda.

**How to apply (ao juntar daily books):**
- Cadeia de join: `daily_book_assignments -> daily_book_positions -> daily_books ->
  agenda_events -> show_books -> users`. A DATA e a OPERAÇÃO vêm do `agenda_events`
  (o daily book referencia `agendaEventId`). Não há horários por posição — herdam do evento.
- Filtros OBRIGATÓRIOS senão aparecem blocos-fantasma:
  - `daily_books.status IN (PUBLISHED, REPUBLISHED)`
  - `daily_book_assignments.status IN (ASSIGNED, AT_RISK)` — REMOVED/OPEN ficam de fora.
    (o backend marca assignment como REMOVED SEM limpar `userId`, por isso o filtro de status é o que protege)
  - `daily_book_positions.isRemoved = false`
  - `userId IS NOT NULL`
- Dedup contra alocações reais por chave `userId|data|roleId`, onde no daily book
  `roleId = daily_book_positions.sourceRoleId` e na alocação real `roleId = positionId`
  (ambos referenciam `show_book_roles.id`). Data real = `manualDate ?? eventDate`.
- Shape virtual igual ao das alocações + `isDailyBookParticipant:true` e
  `agendaEventId:null` (pôr null evita que o frontend o trate como "Auto"/generated).
- Frontend (`web-admin scales.tsx`): badge/cor própria ("Livro do Dia", emerald) e o
  botão de apagar é escondido para virtuais (`!agendaParticipant && !dailyBookParticipant`).

Roadmap acordado (FORMATO da escala mantém-se — colunas por pessoa, a utilizadora gosta):
Fase 2 blocos por show (boas-vindas/maquiagem — precisa horários por show, schema novo);
Fase 3 recorrentes (dia-semana+hora+grupos/avulsos); Fase 4 agenda; Fase 5 tempo livre/tarefas.
