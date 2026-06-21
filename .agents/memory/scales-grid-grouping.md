---
name: Escala semanal — grade agrupa por data
description: Por que linhas geradas pelo motor somem da grade de membros da Escala Semanal e como evitar
---

A grade de membros/dia da Escala Semanal (web-admin admin/scales.tsx) agrupa as alocações por DATA.

**Regra:** alocações MANUAIS têm `manualDate` preenchido; alocações GERADAS pelo motor têm `manualDate = null` e em vez disso um `agendaEventId` (a data real vem do evento da agenda). Se a grade agrupar só por `manualDate`, as linhas geradas somem da tela (ficam só na contagem de "Saúde").

**Como aplicar:** ao montar a grade, coalescer a data: `manualDate ?? eventDate`. Para isso o endpoint `GET /scales/:id/allocations` precisa fazer leftJoin em `agendaEventsTable` e devolver `eventDate/eventTitle/eventStartTime/eventEndTime` — senão o front não tem a data do evento para posicionar a linha gerada.

**Why:** revisão de código reprovou a feature porque o supervisor não conseguia ver/ajustar as sugestões automáticas na escala — elas existiam no banco mas eram filtradas no front por `manualDate` nulo.

**Restrição do produto:** manter a escala enxuta — só nome (e rótulo da atividade/papel) por dia/membro; NÃO trazer a estrutura do Livro do Show (linhas, papéis, rodízio) para dentro da escala. Linha gerada recebe badge "Auto" e o mesmo botão de remover (DELETE /entries/:entryId apaga por id, manual ou gerada).
