# Fase B — entrega (30/09/2026)

Plano de lançamento: <https://claude.ai/artifact/SADbLpDDWSgQCr7UitJ64m>, Fase B "Consertar o que quebra".
Feito por Claude (sessão de Escalas/Livro do Dia). **Não toquei na ASA** (`routes/asa.ts`,
`services/asa-*`, `global-asa-assistant.tsx`, `pages/admin/asa.tsx`).

## Resumo

Os cinco itens da Fase B estão feitos, com teste automatizado contra o Postgres de teste e
conferência no navegador com sessão real (Barbara, Deborah e Julia numa organização de teste).
Durante o trabalho apareceram mais três defeitos da mesma família, e eles também foram corrigidos
(marcados como "extra" abaixo).

| Item | O que estava errado | O que mudou |
|---|---|---|
| B1 · Check-in | O seletor de local vinha do `dados-de-exemplo.json` e mandava `locationId=snowland`; o servidor respondia 403 | Fora da amostra, locais e pessoas vêm da API (`/api/escalas/locais`, `/api/users`) |
| B1 extra · Check-in | A lista de quem marcar presença usava as pessoas da amostra (id = nome), então ficava vazia | Idem: pessoas da API |
| B1 extra · Check-in | A Supervisão não conseguia registrar presença: os blocos de `GET /day-checkins` não traziam `scaleId`, e o POST voltava 400 | `GET /day-checkins` devolve `scaleId` em cada bloco |
| B1 extra · Check-in | `locationId` que não é UUID ia até o banco e virava erro interno | `assertLocationScope` recusa antes da consulta: 403 limpo |
| B1 extra · Folgas | O calendário filtrava os pedidos pelas pessoas da amostra, então nunca mostrava pedido real; a Supervisão via sempre "Patinadores" | Fora da amostra, usa os pedidos já recortados pelo servidor e o nome da área real |
| B2 · Tarefas | `/api/tasks/my` dava 500: `leftJoin(responsibilitiesTable)` duplicado | Linha duplicada removida |
| B2 extra · Tarefas | A Supervisão sem a responsabilidade `TASK_APPROVALS` recebia 403 em `/api/tasks?operationId=` e a tela inteira virava erro | A regra do servidor ficou igual. A tela mostra as tarefas da própria pessoa e o aviso "a Administração precisa te dar a responsabilidade Aprovação de tarefas" |
| B3 · Login | O app abria sem sessão, como "Elenco"; não havia botão de sair; depois do login ia para `/admin/home` | Sem sessão, redireciona para `/login` (exceto a amostra local do Vite); endereço desconhecido redireciona para `/meu-dia`; botão Sair no rodapé do menu e no Perfil; login leva a `/meu-dia` |
| B4 · Links dos avisos | 21 chamadas gravavam links que não existem mais (`/(tabs)/...`, `/membro/...`, `/admin/home`) | Tradução única em `lib/app-routes.ts`, aplicada onde todo aviso é gravado e enviado; o service worker usa o link que vem no aviso |
| B5 · Texto de construção | Etiqueta "Shell pronto" em quatro telas; aviso falso "Formação desativada · Desfazer" no shell; Painel com "Cobertura 100%" e zero pessoas esperadas | Etiqueta e aviso falso removidos; o Painel mostra "—" e "ninguém escalado hoje em escala publicada" |

## Para o Codex: contratos novos

1. **Link de aviso:** todo `actionUrl` passa por `normalizeActionUrl(url, type)` em
   `artifacts/api-server/src/lib/app-routes.ts`. Isso já acontece em `createNotification`, na
   gravação da fila (`notification-outbox.ts`) e no push (`web-push.ts`). Em código novo, use
   direto `APP_ROUTES.*` (`/escalas`, `/livro-do-dia`, `/check-in`, `/mural`...). Se criar tela
   nova, acrescente a rota em `CURRENT` nesse arquivo.
2. **Shell (`shell-foundation.tsx`):** existe um guard logo antes de `if (!active) return null`.
   Sem sessão, redireciona para `/login`. Endereço que não é item do menu do perfil (nem
   `/perfil`) redireciona para `/meu-dia`. **Tela nova precisa estar no array `groups`, senão
   redireciona.** `useSignOut()` chama `POST /api/auth/logout` e limpa a sessão local.
3. **Amostra × dado real:** `dados-de-exemplo.json` só pode alimentar a tela quando
   `import.meta.env.DEV && ?amostra=1`. Fora disso, pessoas e locais vêm da API. O
   `useCycleDirectory()` em `operational-cycle.tsx` é o modelo.
4. **`GET /api/day-checkins`:** agora cada bloco tem `scaleId`.

## Arquivos alterados

- `artifacts/api-server/src/lib/app-routes.ts` (novo)
- `artifacts/api-server/src/services/notificationService.ts` (2 linhas, só `normalizeActionUrl`)
- `artifacts/api-server/src/services/notification-outbox.ts` (1 linha)
- `artifacts/api-server/src/services/web-push.ts` (1 linha)
- `artifacts/api-server/src/routes/tasks.ts` (join duplicado removido)
- `artifacts/api-server/src/routes/operational-cycle.ts` (validação de UUID e `scaleId` nos blocos)
- `artifacts/api-server/tests/fase-b-regressoes.test.ts` (novo) e `tests/run-tests.mjs` (registro)
- `artifacts/web-admin/src/components/shell-foundation.tsx` (guard, Sair, remoção de "Shell pronto" e `SavePatterns`)
- `artifacts/web-admin/src/shell-foundation-navigation.css` (estilo `.asa-signout`)
- `artifacts/web-admin/src/pages/login.tsx` (redireciona para `/meu-dia`)
- `artifacts/web-admin/src/pages/operational-cycle.tsx` (`useCycleDirectory`, Check-in, Folgas, Painel)
- `artifacts/web-admin/src/pages/responsibilities-tasks.tsx` (403 da equipe não derruba a tela)
- `artifacts/web-admin/public/sw.js` (usa `message.url`; cache `v2`)

## Testes (banco de teste, `.env.test`)

- `fase-b-regressoes.test.ts`: **28 verificações passando**. Cobre links antigos → telas novas,
  check-in com local real (Supervisão e Administração), `scaleId` nos blocos, POST de presença
  com o mesmo corpo que a tela envia, `/tasks/my` nos três perfis, aviso gravado com o link novo,
  e Sair derrubando a sessão no servidor (refresh volta 401).
- Mutação (quebrar de propósito para ver o teste falhar): join duplicado de volta → 3 falhas;
  aviso gravado sem tradução → 2 falhas; blocos sem `scaleId` → 2 falhas. Tudo restaurado depois.
- Rodaram de novo e passaram:
  - grupo-b: 17
  - escalas-dia: 54
  - permission-matrix: 351/351 rotas com 401 sem sessão, e 23 verificações
  - block5: 14
  - block6: 231
  - block7: 76 (passou nesta rodada)
  - agenda-group-d: 5
  - daily-book-fill: 84
- `grupo-c-communication`: falhou uma vez sem mensagem de verificação, dentro da rodada em lote.
  Depois passou **3 vezes seguidas** sozinho (98 verificações). Suspeita: execução simultânea no
  mesmo banco de teste. Fica anotado como instável até repetir.
- Typecheck da API e do front passando com os arquivos do Codex no disco.

## Conferido no navegador (sessão real, sem digitar senha)

- Sem sessão: `/check-in` → `/login`.
- Deborah: Check-in mostra Snowland e as pessoas dela. Ela registrou a chegada da Carol pela
  tela ("2 chegaram"). Folgas mostra "Patinadores" vindo do servidor. Responsabilidades abre com
  o aviso de "Aprovação de tarefas", em vez de erro.
- `/admin/home` → `/meu-dia`.
- Julia: Responsabilidades abre sem erro; Sair pelo menu no celular → `/login`, sessão removida
  do aparelho, e o servidor recusa renovar (401).
- A amostra `?amostra=1` continua funcionando em Check-in e Folgas.

## O que continua de fora (próximas fases)

- **Meu Dia** e **Registro** ainda são marcadores (C1, C6). Ao entrar, a pessoa cai no Meu Dia
  marcador.
- Publicar a Escala ainda não avisa ninguém (C2). O lembrete do turno e a impressão ainda leem o
  modelo antigo (C3).
- Nomes reais do `dados-de-exemplo.json` ainda vão para o build de produção (D1).
- Avisos já gravados antes desta mudança mantêm o link antigo no banco. Não há migração deles; o
  shell redireciona endereço desconhecido para o Meu Dia.

## Estado do banco de teste

Ficou a organização "Auditoria 2026-09-30T13:06" (Snowland, 19 pessoas, uma Escala e um Livro
publicados, dois check-ins), com todas as sessões revogadas. Os scripts temporários foram
apagados do repositório.
