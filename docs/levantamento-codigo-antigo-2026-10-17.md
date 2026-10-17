# Levantamento do código antigo (17/10/2026)

Pedido: listar o que é antigo e dá para tirar. **Nada foi apagado.** Este arquivo diz o que é, quanto pesa, o que ainda
depende de quê e em que ordem tirar. Os números vêm de medição no repositório (não de memória); onde a medição é aproximada,
está dito.

## Resumo

| Bloco | O que é | Tamanho | Risco de tirar |
|---|---|---|---|
| A | Site: telas e peças que nenhuma rota alcança | **114 arquivos · ~34 mil linhas** (de 201 no site) | baixo |
| B | Aplicativo de celular antigo (`artifacts/mobile`) | 50 arquivos de código · ~15 mil linhas · 124 versionados · 6,9 MB | médio (2 testes, avisos do servidor, lockfile) |
| C | Servidor: rotas que só o antigo chama | **156 de 464 rotas** (aproximado) | médio a alto, uma a uma |
| D | Delegações ("capitão") | 4 rotas + tabela + 6 pontos do servidor | pede decisão |
| E | Grupos operacionais antigos (equipes) | tabela usada por 12 arquivos do servidor | alto, não tirar agora |
| F | Arquivos soltos na raiz | ~250 MB fora do código, boa parte nem é versionada | baixo |
| G | Documentos velhos | 81 arquivos em `docs/`; cerca de 60 são da fase de desenho | baixo |

## A · Site: o que ninguém alcança

Medi tudo o que `main.tsx` alcança por `import` (estático ou `import()`), seguindo os atalhos `@/`. O resto não carrega em
tela nenhuma.

| Pasta | Arquivos | Linhas |
|---|---|---|
| `pages/admin` (telas antigas da Administração) | 26 | 16.944 |
| `pages/supervisor` | 17 | 7.025 |
| `pages/membro` | 9 | 3.583 |
| `components/ui` (biblioteca de peças shadcn: botão, diálogo, tabela…) | 49 | 5.421 |
| `components` soltos: `admin-layout`, `AsaConfirmDialog`, `AsaSpeechBubble`, `global-search`, `member-combobox`, `pwa-installation-report` | 6 | 767 |
| `pages`: `formation-actions`, `location-actions`, `search-result`, `not-found` | 4 | 75 |
| `lib`: `daily-book-grouping`, `operational-constants` · `hooks/use-mobile` | 3 | 113 |

- As telas vivas (Escalas, Livro, Folgas, Mural, Mensagens, Agenda, Tarefas, Biblioteca, Cadastros, Painel…) **não usam**
  nenhuma peça de `components/ui`: usam estilo próprio. Essas 49 peças só existem por causa das telas antigas.
- O `index.css` já manda o Tailwind ignorar `pages/admin`, `supervisor`, `membro` e `admin-layout` (4 linhas `@source not`).
  Quando as pastas saírem, essas linhas saem junto.
- Como confirmar antes de apagar: `tsc` e build do site continuam passando. O teste do navegador que existe
  (`artifacts/web-admin/tests/abre.spec.ts`) só confere que o site carrega com o título "My ASA"; para valer como prova, abrir
  as telas principais a mão (ou ampliar esse teste) antes e depois.
- **Cuidado:** o mapa e o AGENTS.md dizem que `pages/admin/groups.tsx` e `supervisor/grupos.tsx` "continuam no repositório
  sem uso". É isto aqui. Nenhuma tela viva importa nada dessas pastas.

## B · Aplicativo de celular antigo

`artifacts/mobile` (Expo / React Native). Última alteração no git: **16/10/2026** (alguém ainda o atualiza junto com a ASA).

Ele está preso a:
- **`pnpm-lock.yaml`**: 587 linhas de Expo e React Native; sair o app reduz a instalação de todo mundo.
- **2 testes da API**: `asa-capabilities.test.ts` e `asa-suggestion-contract.test.ts` conferem a lista de ações que o
  celular conhece (por exemplo `FOLGA_LOTE`). Sairiam ou mudariam.
- **O servidor manda avisos com endereços do celular**: `/(tabs)/mais` (4 vezes), `/(tabs)/scale`, `/(tabs)/daily-book`,
  `/(tabs)/mensagens`, `/(tabs)/solicitacoes`, `/(tabs)/avisos` (14 ocorrências em `artifacts/api-server/src`). No site, o aviso
  precisa levar à tela certa do site; hoje esses endereços não existem lá.
- **4 scripts de imagem** em `scripts/` (`build-asa-mobile-clean-assets`, `generate-icons`, `slice-asa-poses`, `verify-asa-assets`).
- `replit.md`, `MIGRATION_AUDIT.md` e 37 documentos em `docs/` que citam "mobile" ou "celular" (em geral como história).
- Ele usa o cliente gerado `@workspace/api-client-react` (38 imports): esse cliente **também é do site**, fica.
- Há 14 mil linhas que ninguém abre: o site funciona no celular (toda tela se confere a 375 px), então o app não cobre nada que o
  site não cubra.

## C · Servidor: rotas que só o antigo chama

Para cada uma das 464 rotas do servidor perguntei: o site vivo chama? Só o celular, o cliente gerado ou as telas mortas chamam?
Ninguém chama? **A conta é aproximada** (olha o texto do caminho nas chamadas; caminho montado em pedaços escapa). Use como
mapa, não como ordem de apagar.

- **276 rotas** têm chamador no site vivo.
- **156 rotas** só têm chamador no celular, no cliente gerado ou nas telas mortas. Onde mais pesa:

| Arquivo | Rotas | Só no antigo |
|---|---|---|
| `scales.ts` (modelo antigo de escala: `/scales`, `/entries`, `/allocations`) | 20 | 17 |
| `show-book.ts` | 46 | 16 |
| `daily-book.ts` | 22 | 13 |
| `deliveries.ts` (Entregas) | 11 | 11 |
| `notices.ts` (avisos antigos; hoje é o Mural) | 10 | 10 |
| `groups.ts` (equipes antigas) | 9 | 9 |
| `insights.ts` | 7 | 7 |
| `agenda.ts` | 12 | 7 |
| `history.ts` | 7 | 6 |
| `check-ins.ts` (hoje é check-in por turno) | 5 | 5 |
| `operations.ts` | 6 | 5 |
| `activities.ts`, `restrictions.ts`, `delegations.ts` | 4 cada | 4 cada |
| `roles.ts`, `supervisor-requests.ts` | 3 cada | 3 cada |

- **32 rotas sem chamador nenhum** na medição. Conferi à mão e **várias são falso alarme**: `POST /daily-book/:id/reopen` e as
  rotas da lista fixa das responsabilidades são usadas (o caminho é montado no código). Duas são do agendador
  (`/internal/ciclo`, `/internal/tarefas-do-dia`) e ficam. As que sobram precisam de conferência uma a uma.
- Apagar uma rota é apagar também o teste que a cobre; a matriz de permissões (`permission-matrix`) lê as rotas do código e
  vai acompanhar.
- **Parte dessas rotas é usada por dentro**: `scales.ts` mexe na mesma tabela da Escala nova; o que sai é o caminho antigo
  de HTTP, não a tabela.

## D · Delegações (o "capitão")

O que existe: tabela `delegations`, 4 rotas em `delegations.ts`, e **seis pontos do servidor que consultam a delegação**:
`lib/delegation-check.ts` (usado por `asa.ts`, `check-ins.ts`, `notices.ts`, `requests.ts`, `checkin-access.ts`,
`scale-access.ts`), e o "encerrar conversa" de `messages.ts` ("Admin, Supervisor ou Capitão delegado").

- **Ninguém consegue criar delegação hoje**: as 4 rotas só são chamadas pelo celular e pelas telas mortas.
- Mas as regras ainda a consultam: quem tinha uma delegação de check-in, de escala ou de mensagens **continua com o acesso**.
- Desde hoje ela **não vale mais** para o Livro do Dia (`canOperateDailyBook`). `hasActiveResponsibilityForShow` ficou sem uso.
- Antes de tirar, olhar em **produção** se há delegação ativa (consulta só de leitura, sugestão abaixo). Se não houver,
  dá para tirar o módulo inteiro; se houver, é preciso dar a essas pessoas o acesso certo (Supervisão) primeiro.

```sql
select count(*) filter (where revoked_at is null and (valid_until is null or valid_until > now())) as ativas, count(*) as total
from delegations;
```

## E · Grupos operacionais antigos (equipes)

A tela já saiu do menu (16/10), mas a **tabela `operational_groups` é lida por 12 arquivos do servidor**: `folgas.ts`,
`my-day.ts`, `organization.ts`, `users.ts`, `roles.ts`, `activities.ts`, `asa.ts`, `operational-panel.ts`,
`auth.service.ts`, `operation-lifecycle.ts`, `scheduling-eligibility.ts`, `groups.ts`. **Não tirar agora**: a limpeza é do
código que lê, uma leitura de cada vez, e mexe em folga e em quem pode ser escalado.

## F · Arquivos soltos na raiz

| O que | Tamanho | Situação |
|---|---|---|
| `replit.md`, `.replit`, `replit.nix`, `.replitignore` | 4 arquivos | sobras do Replit; `replit.md` ainda tem o texto de modelo ("[Project name]") |
| `MIGRATION_AUDIT.md` | 12 KB | guia de migração Replit → Vercel; a migração já foi feita |
| `attached_assets/` | 200 arquivos · 16 MB | anexos do Replit; só um script (`slice-asa-poses.mjs`) e o atalho `@assets` do `vite.config.ts` apontam para lá |
| `exports/` | 3 arquivos | manual em PDF/HTML |
| `artifacts/mockup-sandbox/` | 99 arquivos · 900 KB | tela de protótipo do Replit; só ele mesmo o usa |
| `artifacts/brand/` | **104 MB** | **não é versionado** (nem está no `.gitignore`): só ocupa disco |
| `output/` | **79 MB** | **não é versionado**: capturas de tela e resultados de teste |
| `my-asa-main.zip` | 26 MB | **não é versionado**: cópia compactada do projeto |
| `.playwright-mcp/` | 2,8 MB | **não é versionado**: lixo do navegador de teste |
| `Nuevo Documento de texto.txt` | 1 KB | **não é versionado** |
| `tmp/` | 17 MB | já está no `.gitignore` |
| `design_handoff_my_asa/` | 11 MB · 86 arquivos | **FICA**: os dados de amostra (`dados-de-exemplo.json`) vêm daqui e o `verificar-nomes-build` lê o mesmo arquivo |

## G · Documentos velhos

`docs/` tem 81 arquivos. Cerca de 60 (pelo nome) são da fase de desenho "MyASA 2.0" (agosto e setembro: `RELATORIO-*`, `FASE-*-ENTREGA`,
`BLOCO*`, `wireframe-*`, `ux-pesquisa-*`, `*-myasa-2.0.md`). Os que contam a decisão atual são `AGENTS.md`, os handoffs de
14 a 17/10, `regras-de-folgas.md`, `tarefas-e-responsabilidades.md`, `mural-aberto.md`, `mensagens-grupos.md`,
`plano-*`, `mapa-de-revisao.md` e `empresa-de-teste.md`. Proposta: mover os velhos para `docs/arquivo/` (continuam no git,
só saem da frente).

## Ordem proposta

| Etapa | O que | Antes de começar | Como conferir |
|---|---|---|---|
| 1 | **F**: apagar `output/`, `.playwright-mcp/`, `my-asa-main.zip`, o `.txt` solto e pôr `artifacts/brand/` e `output/` no `.gitignore` | confirmar que o zip não é a única cópia de nada | espaço em disco; `git status` limpo |
| 2 | **A**: apagar as 114 peças do site e as 4 linhas `@source not` | nada | `tsc`, build, `verificar-nomes-build`, abrir as telas principais |
| 3 | **F**: `replit.*`, `MIGRATION_AUDIT.md`, `mockup-sandbox`, `attached_assets` (movendo antes o PNG que o script de poses usa), `exports` | decidir se o `attached_assets` some | build do site (o atalho `@assets`) |
| 4 | **G**: mover os documentos velhos para `docs/arquivo/` | você apontar quais contam | nenhum código depende |
| 5 | **B**: apagar `artifacts/mobile` | decidir o destino dos avisos `/(tabs)/…` (levar à tela do site) e dos 2 testes da ASA | `pnpm install`, `tsc`, testes `asa-*` |
| 6 | **D**: consulta em produção; se zero delegações ativas, tirar o módulo; senão, migrar as pessoas | resultado da consulta | testes de permissão, `grupo-c-communication` |
| 7 | **C**: rotas, **um arquivo de rota por vez**, começando por `deliveries`, `notices`, `groups`, `insights`, `activities`, `restrictions`, `check-ins` e o modelo antigo de `scales` | etapas 2 e 5 feitas | `permission-matrix` e o teste do arquivo correspondente |
| 8 | **E**: grupos operacionais | só depois de C | folgas e Escala |

As etapas 1, 2, 3 e 4 não mexem em nada que o app em produção use. As etapas 5 a 8 mexem em servidor e pedem a ordem de
promoção de sempre: nada de migração envolvido, mas API antes, site depois.

## Como medi e o que não cobre

- Alcance do site: percorri os `import` a partir de `main.tsx`; um arquivo carregado por caminho montado em texto
  (`import.meta.glob`, `import(variavel)`) escaparia. Procurei e não há.
- Rotas: comparei o texto dos caminhos; por isso a lista de "ninguém chama" tem falso alarme e a de "só o antigo" é aproximada.
- Não olhei produção. A consulta de delegações é a única que depende dela.
