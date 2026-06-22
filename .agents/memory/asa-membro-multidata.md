---
name: ASA — um membro em várias datas (folgas)
description: Evitar consultar_membros repetido; usar lote para mesmo membro em múltiplas datas
---

Sintoma: ASA fica lenta porque chama consultar_membros uma vez por DATA ao registar folgas de um membro em vários dias (ex.: "folga para a Amanda nos dias 03,04,10,17...").

Causa: o system prompt da ASA (artifacts/api-server/src/routes/asa.ts) cobria lote só para VÁRIOS membros; para "1 membro" mandava usar ferramentas individuais, e a regra "resolva o nome antes de agir" levava a re-resolver por data.

Correção (durável): no guia de lote, "um membro em várias datas" também é LOTE:
- consultar_membros UMA vez por nome (nunca por data) — regra de eficiência explícita e proibição de repetir.
- dias avulsos → registrar_ausencias_lote, um item por data (mesmo userId, type DAY_OFF).
- período contínuo → registrar_ausencia único com startDate+endDate.

**Why:** cada chamada de tool = 1 round-trip ao Claude; menos chamadas = muito mais rápido. registrar_ausencias_lote aceita o mesmo userId em datas diferentes (chama coreRegistrarAusencia por item).

**How to apply:** ao mexer no fluxo de folgas/ausências da ASA, manter a regra "resolver nome 1x" e preferir lote para multi-data.
