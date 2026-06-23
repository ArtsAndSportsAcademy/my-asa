---
name: Deep-link para aba com nonce
description: Como abrir uma aba já num item específico (param de rota) e permitir reabrir o mesmo item
---

Para criar um atalho entre ecrãs de abas no mobile (expo-router) — ex.: tocar num show na escala e abrir a aba do Livro do Dia já naquele show — passa-se um param de rota (`eventId`) via `router.push({ pathname, params })` e lê-se com `useLocalSearchParams`. A aba auto-seleciona o item num `useEffect`.

**Problema:** se o utilizador tocar no mesmo show outra vez (mesmo `eventId`), o `useEffect` NÃO volta a disparar porque o valor do param não mudou. Um guard por `eventId` agrava isto.

**Regra:** enviar também um `eventNonce` (`String(Date.now())`) em cada toque. O guard (`appliedNonceRef`) usa o nonce, não o `eventId`. Assim cada toque re-aplica a seleção, mesmo que o utilizador tenha escolhido outro item à mão entretanto.

**Why:** params iguais não re-disparam efeitos; sem nonce, o atalho "fica preso" no item errado após seleção manual.

**How to apply:** esperar a lista carregar (`if (listLoading) return`) antes de decidir; se não houver match (ex.: livro ainda não publicado para o evento), limpar a seleção e sinalizar estado (banner amigável) em vez de deixar um item anterior visível.
