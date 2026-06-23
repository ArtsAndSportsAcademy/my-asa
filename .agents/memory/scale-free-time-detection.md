---
name: Tempo livre na escala (deteção de buracos)
description: Como/onde se deteta "tempo livre" por pessoa na escala (frontend + backend partilhado) e porquê
---

A deteção de "tempo livre" (buracos) por pessoa/dia na escala é **read-time, sem schema novo**. A regra existe em DOIS sítios que têm de ficar em sincronia:
- Frontend: `artifacts/web-admin/src/pages/admin/scales.tsx` (constantes da janela do dia).
- Backend: `artifacts/api-server/src/services/scale-merge.ts` — `computeFreeGaps(blocks)` + `WORK_DAY_START_MIN`(07:40) / `WORK_DAY_END_MIN`(18:00) / `MIN_FREE_GAP_MIN`(60). Tem comentário "MANTER EM SINCRONIA" com scales.tsx.

O mesmo serviço também exporta `resolveScaleAllocations(scale)` — a mesclagem read-time da escala (alocações reais + Livro do Dia + agenda + atividades recorrentes), extraída do endpoint GET /api/scales/:id/allocations. A ASA reutiliza ambos: `consultar_escalas` (visão mesclada, campo "origem") e `consultar_tempo_livre`.

**Regra:** tempo livre = complemento dos blocos com hora dentro da janela do dia. Preenche-se reutilizando entrada manual/tarefa.

**Why:** não existe conceito de jornada/working hours no esquema; constante é mais simples e prod-safe (não partir a app publicada; prod não corre migrações).

**How to apply:**
- Bloco do dia sem horário → NÃO sugerir tempo livre (bail-out lista vazia).
- Quem está de folga ACTIVE na data não conta. CRÍTICO: filtrar folgas por `operationId` (folgasTable tem operationId notNull) — senão folga noutra operação marca falso "indisponível".
- Só gestores; pessoa sem folga; escala não ARQUIVADA.
- Mudar a janela = editar as constantes nos DOIS ficheiros (não há migração).
