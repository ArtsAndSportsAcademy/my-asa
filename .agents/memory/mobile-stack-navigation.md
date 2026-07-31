---
name: Navegação mobile — estrutura (stack) vs (tabs)
description: Ecrãs secundários vivem em app/(stack)/, não em (tabs)/; back gesture funciona via Stack navigator
---

## Regra
Qualquer novo ecrã que não seja uma das 4 abas primárias (meu-dia, avisos, mensagens, mais) deve ir em `artifacts/mobile/app/(stack)/`, nunca em `(tabs)/`.

**Por quê:** Tabs não têm histórico de navegação — sem gesture de voltar (iOS), sem botão hardware (Android). Stack empilha ecrãs e dá os dois automaticamente.

## Estrutura atual
- `app/(tabs)/` → 4 abas + seus sub-layouts apenas: `meu-dia`, `avisos`, `mensagens`, `mais`
- `app/(stack)/` → todos os 17 ecrãs secundários: asa, scale, daily-book, show-book, agenda, folgas, tarefas, solicitacoes, responsabilidades, entregas, biblioteca, historico, historico-asa, panel, insights, notificacoes, index (Perfil)
- `app/_layout.tsx` → auth guard trata `(tabs)` E `(stack)` como grupos autenticados

## BackButton
`components/BackButton.tsx` — Pressable com `router.back()` + Feather chevron-left. Importar em cada ecrã secundário. A maioria dos headers usa pattern: `<BackButton />` como 1º filho da View de cabeçalho.

## Navegação para ecrãs secundários
- `router.push("/(stack)/X")` — de qualquer lugar
- Abas que ficam como `/(tabs)/`: `avisos`, `mensagens`, `meu-dia`
- meu-dia.tsx usa `/(tabs)/avisos` e `/(tabs)/mensagens` (CORRETO — são abas reais)

## Como adicionar um novo ecrã secundário
1. Criar `app/(stack)/novo-ecra.tsx`
2. Importar `BackButton` de `@/components/BackButton`
3. Adicionar `<BackButton />` no cabeçalho
4. Navegar com `router.push("/(stack)/novo-ecra")`
5. NÃO registrar em `(tabs)/_layout.tsx`
