---
name: Mobile tabs — NativeTabs overflow e headerShown
description: Por que a barra de abas usa Tabs clássico (não NativeTabs) e a regra de safe-area de topo
---

# Barra de abas do mobile (artifacts/mobile/app/(tabs)/_layout.tsx)

## Regra: máximo 5 abas primárias; usar Tabs clássico (não NativeTabs)
Os `NativeTabs` do `expo-router/unstable-native-tabs` (iOS 26 "liquid glass") criam
uma aba "More" NATIVA do UIKit quando há 6+ triggers. Essa aba ficava preta/quebrada
e prendia os ecrãs excedentes (ex.: Escala+Mais), impedindo abri-los.

**Regra:** manter no máximo 5 abas primárias e usar SEMPRE o `Tabs` clássico do
expo-router. As 5 atuais: Meu Dia, Avisos, Central, Mensagens, Mais. A Escala deixou
de ser aba primária e vive no hub "Mais" (mais.tsx). Demais ecrãs continuam
roteáveis via `router.push("/(tabs)/...")` com `tabBarButton: () => null`.

**Why:** a API native-tabs é experimental ("unstable") e o overflow nativo é
incontrolável; correção > liquid glass. O Tabs clássico mantém blur no iOS.

## Regra: headerShown:false + cada ecrã faz a sua própria safe-area de topo
O `Tabs` clássico tem `headerShown: false` porque TODOS os ecrãs de (tabs)
renderizam o próprio cabeçalho. Como não há cabeçalho de navegação em NENHUMA
plataforma, todo ecrã DEVE compensar o topo com `insets.top` (useSafeAreaInsets),
senão o conteúdo fica sob a status bar/notch.

**Atenção:** ao criar/editar um ecrã em (tabs), garanta `paddingTop: insets.top + N`
no container de topo. Ecrãs que só usavam `insets.bottom` (mais, panel, insights,
solicitacoes, tarefas) precisaram ser corrigidos.

## ASA (chat) — input não pode ficar atrás da barra nem do teclado
- O ecrã `asa` recebe `tabBarStyle: { display: "none" }` na sua Tabs.Screen (chat
  precisa do espaço inferior; barra de abas atrapalha o input).
- `asa.tsx`: `KeyboardAvoidingView` com `keyboardVerticalOffset={0}` (é root
  full-screen, sem header de navegação e com a barra oculta). O valor antigo (88)
  assumia header+barra e empurrava o input para fora.

## ASA web (artifacts/web-admin/src/pages/admin/asa.tsx)
Container do chat: `h-[calc(100dvh-14rem)] min-h-0`. O `100vh-12rem` antigo
subestimava cabeçalho+subtítulo do AdminLayout (main é min-h-screen, cresce livre)
e cortava o campo de input. Usar `dvh` (chrome do browser) e folga de 14rem.
