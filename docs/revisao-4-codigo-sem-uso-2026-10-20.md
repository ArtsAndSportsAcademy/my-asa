# Revisão 4, assunto 10: levantamento de código sem uso (20/10/2026)

**Só leitura.** Nada foi apagado nem movido. Este arquivo é a lista e a recomendação; a limpeza depende de decisão sua.

## Como medi

- **Site:** parti de `src/main.tsx` e segui todo `import` e `import()` (inclusive o `lazy()` do shell). O que não é alcançado
  daí não aparece em nenhuma tela viva. Rodei com um script (`alcance`, no bloco de notas da sessão; refazer é rápido).
- **API:** para cada roteador, contei quantas rotas têm o prefixo `/api/<assunto>` escrito em algum arquivo vivo do site.
  O site vivo só usa dois ganchos do cliente gerado (`useLogin`, `useChangeMyPassword`); todo o resto é `customFetch` com o
  caminho escrito, então a contagem por texto vale. Limite: a ASA chama regra de negócio direto no servidor, sem passar por
  HTTP, e os testes chamam rotas por HTTP; "sem uso no site" não quer dizer "sem uso no sistema".

## Telas do site

114 dos 177 arquivos `.ts/.tsx` do site não são alcançados a partir de `main.tsx`:

| Grupo | Arquivos | Linhas | Situação |
|---|---|---|---|
| `pages/admin/*` | 26 | ~16.900 | Sem rota. Telas da geração anterior (shadcn + `admin-layout`). |
| `pages/supervisor/*` | 17 | ~7.000 | Sem rota. Inclui `grupos.tsx` (a aba "Grupos" que saiu do menu em 16/10). |
| `pages/membro/*` | 9 | ~3.600 | Sem rota. |
| `pages/formation-actions.tsx`, `location-actions.tsx` | 2 | 37 | Sem rota. Reabrir local com motivo já existe em Cadastros → Locais; **desativar formação não tem tela** (a API `POST /formations/:id/deactivate` existe e fica sem uso). |
| `pages/search-result.tsx`, `pages/not-found.tsx` | 2 | 34 | Sem rota. `search-result` era o destino da Busca (`/admin/search?...`); a Busca agora aponta para telas vivas (commit da Busca) e o shell manda endereço desconhecido ao Meu Dia. |
| `components/admin-layout.tsx`, `AsaConfirmDialog`, `AsaSpeechBubble`, `global-search`, `member-combobox`, `pwa-installation-report` | 6 | | Só as telas mortas importam. |
| `hooks/use-mobile.tsx`, `lib/daily-book-grouping.ts`, `lib/operational-constants.ts` | 3 | | Idem. |
| `components/ui/*` (shadcn) | 49 de 55 | | Só 6 são usados pelas telas vivas. |

Total das telas mortas: **cerca de 27.500 linhas** só em `pages/admin|supervisor|membro`.

Nota sobre o handoff de 15/10 e o mapa de revisão: ambos diziam que "admin/supervisor/membro não têm rota". Confirmado agora,
sem exceção (o `/grupos` era a única que tinha, e saiu em 16/10).

## API

Roteadores em que **nenhuma rota** é chamada pelo site vivo (contagem por prefixo):

| Roteador | Rotas | Observação |
|---|---|---|
| `deliveries.ts` | 11 | Entregas antigas. Uma entrega ainda aparece na ASA e na Biblioteca por serviço próprio. |
| `notices.ts` | 10 | Avisos oficiais antigos. O Mural usa `communication-hub.ts`; nenhuma tela viva chama esta. |
| `groups.ts` (`/operational-groups`) | 9 | Ver abaixo. |
| `insights.ts` | 7 | Painel antigo de indicadores. |
| `requests.ts` | 6 | Pedidos antigos (a tela viva usa `/solicitacoes`). |
| `check-ins.ts` | 5 | Check-in antigo (a tela viva usa `shift-checkins` e `day-checkins`). |
| `activities.ts`, `delegations.ts`, `restrictions.ts` | 4 + 4 + 4 | Antigos; `restricoes-horario.ts` é o novo. |
| `supervisor-requests.ts`, `schedule-conflicts.ts`, `operational-panel.ts` | 3 + 2 + 1 | |
| `internal.ts` | 2 | **Não é morta:** é o `POST /internal/ciclo` que o pg_cron chama a cada minuto. |
| `health.ts` | 1 | Idem: vigilância do servidor. |

Cuidado antes de qualquer remoção: `permission-matrix.test` percorre as rotas protegidas (463 em 19/10) e exige 401 sem login;
tirar uma rota exige tirá-la da expectativa. E vários testes (`block5-integrity`, `block7-integrity`, `grupo-b-*`) chamam
essas rotas por HTTP.

## `operational-groups`: o que ainda é vivo

A tela acabou, mas **as funções de `routes/groups.ts` são usadas por outros roteadores**:

- `supervisedOperationIds` e `groupCoveredOperationIds`: `activities.ts`, `folgas.ts`, `organization.ts`, `asa.ts`.
- `loadGroupMembers`: `services/scale-merge.ts` (a mesclagem de escala lê o grupo).
- `loadGroupInOrg`, `createGroupCore`, `renameGroupCore` e vizinhas: a **ASA cria e renomeia grupo por conversa** (`asa.ts`).
- As tabelas `teams` e `team_memberships` são lidas por `escala-dia`, `scheduling-eligibility`, `schedule-conflicts`,
  `operation-lifecycle`, `users` e `undo`.

Ou seja: dá para tirar as **telas** e as **rotas HTTP** de `/operational-groups` (nenhum site vivo as chama), mas **não** o
arquivo `groups.ts` nem as tabelas sem antes migrar essas dependências. A Supervisão de hoje (área + local) não passa por aqui;
o que sobra é o conceito antigo de "equipe" dentro da Escala.

## Recomendação

1. **Tirar as telas mortas do site** (`pages/admin`, `pages/supervisor`, `pages/membro`, as 4 páginas soltas, `admin-layout`, os
   componentes que só elas usam e os 49 `ui/*` sem uso): é código que ninguém roda, pesa ~27.500 linhas, confunde quem lê
   ("qual é a tela de verdade?") e já enganou uma revisão (a Busca apontava para uma delas). Risco baixo: o build do site já
   as descarta do pacote. Faça em um commit só, com `tsc`, build e `verificar-nomes-build`.
2. **Manter por enquanto as rotas da API**, mas anotar no topo de cada roteador sem uso "sem tela desde 20/10/2026". Tirá-las
   mexe em `permission-matrix` e em ~10 arquivos de teste; vale numa etapa própria, depois da bateria completa.
3. **`groups.ts`: manter as funções**, e só apagar as 9 rotas HTTP se você decidir que a ASA não cria mais grupo por
   conversa. Antes, decidir o destino de "equipe" na Escala.
4. **Formação: decidir** se desativar formação precisa de tela (hoje só a API faz).

## Pergunta em aberto do mapa: visão do mês e Etapa 4

Os dois itens aparecem como "pendentes" no `mapa-de-revisao.md`, nos handoffs de 14, 16 e 16/10-sessão-3 e em
`plano-folga-como-troca-e-mes-em-rascunho.md`, sem nenhuma decisão que os descarte.

- **Visão do mês** (calendário e grade pessoa × dia): o *Mapa do mês* existe e foi revisado em 16/10. O que falta, pelo texto dos
  handoffs, é a **grade pessoa × dia** (quem folga em que dia, lado a lado). Não achei decisão da Babi nem pedido novo.
- **Etapa 4** (experimentar grupos da alta temporada, gerar o mês em rascunho e ver o equilíbrio): o plano diz "quando os três
  primeiros estiverem rodando"; os três estão. Mas a decisão de 16/10 fixou **5 grupos fixos no Natal, definidos por Deb, Victor e
  Tef**, o que tira a necessidade de experimentar desenhos diferentes nessa temporada.

**Recomendação:** tratar as duas como *descartadas até haver motivo*, e reabrir só se o primeiro mês real mostrar desequilíbrio de
folga entre as pessoas. Precisa da resposta da Babi (regra de negócio): "vocês ainda querem ver a grade pessoa × dia, ou o
Mapa do mês basta?".
