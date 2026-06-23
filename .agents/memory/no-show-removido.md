---
name: No-show (NO_SHOW) removido da UI — = Folga
description: decisão de produto — No-show é o mesmo conceito que Folga; tirado dos seletores mas enum mantido no banco
---

Decisão da diretora (jun/2026): "No-show" é redundante — **mesmo conceito que Folga**. Removido de TODOS os seletores/legendas de folgas/escala (web-admin + mobile). Tipos válidos na UI: Folga (DAY_OFF), Recesso (RECESSO), Outro (OUTRO); além de Afastamento/Restrição onde já existiam.

**Não mexer no enum** `folgas.type` (NO_SHOW continua no schema/OpenAPI). App publicada + Publish não corre migrações → remover valor de pgEnum partiria prod.

**Dados legados:** registos antigos com type=NO_SHOW são **exibidos como Folga** (rótulo/cor/abreviação de DAY_OFF) em todos os mapas de exibição. Não migrar dados; é só apresentação.

**Why:** evita criar novos NO_SHOW sem quebrar a app publicada nem perder/embaralhar histórico.

**How to apply:** ao mexer em tipos de folga, NUNCA reintroduzir NO_SHOW em seletor/legenda; manter o fallback de exibição NO_SHOW→Folga; ASA não deve oferecer NO_SHOW (usar DAY_OFF para folga de um dia).
