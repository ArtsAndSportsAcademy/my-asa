---
name: Push notifications e agendamento recorrente
description: Decisões duráveis sobre entrega de push (Expo) e jobs recorrentes no MyASA
---

## Entrega de push real (Expo)
- Push é entregue via HTTP direto à API do Expo (sem SDK); token precisa casar `ExponentPushToken`/`ExpoPushToken`.
- **Regra:** o serviço de notificação SEMPRE grava histórico in-app e tenta push como best-effort que NUNCA lança — assim gatilhos (reconhecimento, lembrete) e a Asa seguem mesmo se o push falhar.
  - **Why:** push é canal secundário; falha de rede do Expo não pode quebrar a regra de negócio.
- **Status por device:** gravar status real por token (tickets do Expo voltam na MESMA ordem das mensagens enviadas), nunca um status agregado para todas as linhas.
- Mobile só obtém Expo push token em **device físico / Expo Go** — preview web do workspace NÃO entrega na bandeja; verificação real exige device.
- `getExpoPushTokenAsync` precisa de `projectId` (EAS). Sem projectId no app.json: resolver de `Constants` e degradar silenciosamente (retorna null).

## Jobs recorrentes (sem cron no api-server)
- **Não há cron.** Padrão: scheduler com `setTimeout` auto-reagendável, iniciado DEPOIS de `app.listen` em `index.ts`.
- **Regra:** NÃO disparar no boot; agendar só o próximo horário fixo.
  - **Why:** dev reinicia muito → disparar no boot causaria reenvio/spam. Sem persistência de "já enviado", a dedup depende de rodar 1x/dia no horário.

## Migrations vs. DB real (drift)
- O projeto vinha aplicando mudanças de schema via executeSql/push, deixando as migrations drizzle defasadas do schema em código.
- **Consequência:** `drizzle-kit generate` captura TODO o drift acumulado (não só a sua tabela). Isso é o output canônico e correto para deploy fresh/prod; reviewer exige migration para tabelas novas.
  - **How to apply:** ao adicionar tabela, rode `drizzle-kit generate` e commit a migration + snapshot; o arquivo virá com o drift pendente junto — confira que é aditivo (CREATE/ADD FK), sem DROP destrutivo.
