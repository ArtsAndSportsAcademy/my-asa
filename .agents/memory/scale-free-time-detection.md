---
name: Tempo livre na escala (deteção de buracos)
description: Como/onde se deteta "tempo livre" por pessoa na escala (frontend + backend partilhado) e porquê
---

A deteção de "tempo livre" (buracos) por pessoa/dia na escala é **read-time, sem schema novo**. A regra existe em DOIS sítios que têm de ficar em sincronia:
- Frontend: `artifacts/web-admin/src/pages/admin/scales.tsx` (`computeFreeGaps` + `MIN_FREE_GAP_MIN`).
- Backend: `artifacts/api-server/src/services/scale-merge.ts` — `computeFreeGaps(blocks)` + `MIN_FREE_GAP_MIN`(60). Comentário "MANTER EM SINCRONIA".

O mesmo serviço também exporta `resolveScaleAllocations(scale)` — a mesclagem read-time da escala (alocações reais + Livro do Dia + agenda + atividades recorrentes), extraída do endpoint GET /api/scales/:id/allocations. A ASA reutiliza ambos: `consultar_escalas` (visão mesclada, campo "origem") e `consultar_tempo_livre`.

**Regra (definida pela utilizadora):** o dia de cada pessoa vai da PRIMEIRA até a ÚLTIMA atividade dela nesse dia (modelo check-in/check-out) — NÃO há janela fixa. Tempo livre = buracos ≥ 1h SÓ ENTRE atividades; nunca antes da 1ª nem depois da última. Cada pessoa pode ter um intervalo diferente no mesmo dia (resolve-se sozinho a partir dos próprios blocos).

**Why:** a utilizadora rejeitou janela fixa configurável (07:40–18:00 era hardcoded) porque o horário varia por pessoa e por dia; derivar da 1ª/última atividade dá flexibilidade total sem config nem schema (prod-safe; prod não corre migrações).

**How to apply:**
- Bloco do dia sem horário → NÃO sugerir tempo livre (bail-out lista vazia).
- Quem está de folga ACTIVE na data não conta. CRÍTICO: filtrar folgas por `operationId` (folgasTable tem operationId notNull) — senão folga noutra operação marca falso "indisponível".
- Só gestores; pessoa sem folga; escala não ARQUIVADA.
- Para mudar o limiar mínimo do buraco = editar `MIN_FREE_GAP_MIN` nos DOIS ficheiros (não há migração).
