# Prompt para continuar o My ASA em outra conta (27/10/2026, noite)

**Como usar:** abra o Claude Code na pasta `C:\Users\Usuario\Documents\MyASA\.claude\worktrees\escala-mais-facil` e cole o texto do bloco "PROMPT" abaixo. O resto deste arquivo é o contexto que o assistente vai ler.

---

## PROMPT (cole isto)

Você vai continuar um trabalho no My ASA (app da Arts and Sports Academy: Escala do dia, Livros de show, folgas, comunicação do elenco). A conversa anterior acabou por limite de uso. Antes de qualquer coisa, leia, nesta ordem: `AGENTS.md` (regras de trabalho, em português do Brasil), `docs/prompt-continuar-escala-2026-10-27.md` (este arquivo) e `docs/plano-mestre-escala.md` (plano vivo; a seção 9 é a mais recente). A pessoa que conversa com você constrói o app, **não é programadora**: explique em português simples, passo a passo, diga o que NÃO viu, recomende e proponha (não deixe a decisão solta), e só envie ao GitHub com "pode enviar" dela. **Migração e qualquer coisa em produção é dela, não sua**: você só aplica migração no banco de TESTE e entrega os comandos em blocos de PowerShell (ela usa o botão Run; um comando por bloco, sem `&&`).

Trabalhe na worktree `C:\Users\Usuario\Documents\MyASA\.claude\worktrees\escala-mais-facil` (branch `codex/escala-mais-facil`, tudo enviado ao GitHub até o commit `0094be9`). Nunca faça merge na `main`.

**Primeiro passo:** pergunte a ela, em uma frase, o que ela já promoveu em produção (migração 0087? API? site?) e qual é o assunto de hoje. Não reabra decisões já tomadas (seção "Decisões" abaixo).

---

## 1. Estado (o que está pronto)

Tudo abaixo está commitado e **enviado ao GitHub** (branch `codex/escala-mais-facil`), conferido em testes de API e na tela (empresa de teste, 375 e 1360 px) salvo onde dito "não visto".

| Assunto | Commits | Em produção? |
|---|---|---|
| **Chamadas da Escala F1** (migração 0086: tabela `escala_chamadas`, rotas, leitura) | `33181d0` | **Migração 0086 JÁ aplicada em produção** (27/10, com backup `C:\Users\Usuario\Backups-MyASA\2026-10-27_1539`). API e site ainda não promovidos até onde sei. |
| **Chamadas F2 + F3** (editor nos 3 lugares: tela do show, Programação, atividade só do dia; a chamada vira linha do dia, entra no aviso de convocação, no choque se "ocupa tempo", na Minha escala, Meu Dia, impressão, Livro do Dia) | `abaffb3`, `1175d2a`, `d399106` | Não promovidos |
| **Editar a atividade só neste dia** (migração **0087**, tabela `escala_bloco_edicoes`, rota `POST /escalas/dia/editar`; muda nome, horário para todos e tipo/cor só naquela data; "Voltar ao normal"; show não entra) | `1e383d3` | **Migração 0087 só no banco de teste** até onde sei: ela recebeu os 3 blocos (backup, ensaio, aplicar) mas confirme. API e site não promovidos. |
| **Folha impressa (PDF) simples**: "Elenco do dia" (sem número) e nome da área em vez de lista, sem linha extra para quem teve horário cortado, chamada embaixo da atividade, janela flexível "Cada um cumpre dentro da janela", "Pessoas de folga" | `946cb5c`, `2321912` | Não promovidos (precisam da API nova: o bloco ganhou `quemRegra`/`areaNomes`) |
| **Botão "Editar este texto" na folha** (só para aquela impressão, nada é salvo) | `920e3a0` | Não promovido (só site) |
| **Guardião 1 a 8 em ordem** na folha e na Escala | `0094be9` | Não promovido (só site) |

**Ordem para promover (ela faz):** migração 0087 (se ainda não) → API → site. A API e o site promovem tudo acima junto. Depois: leia em produção (SÓ LEITURA) a Escala de um dia com show e confira as linhas "Chamada · SHOW" (as horas de chamada antigas migradas viram chamadas que só informam) e a folha de Snowland.

## 2. Pendências

1. **Visão "Todos os locais"** (ideia da Babi, **nada decidido**): ver o dia inteiro de cada pessoa em todos os locais, com aviso de sobreposição/duplicidade entre locais. Hoje cada local tem a sua Escala e o choque só vale dentro do local (o Meu Dia já junta os locais). Minha recomendação (não aprovada): manter uma Escala por local e criar uma visão "Todos os locais" na Atividade do dia (linha do dia por pessoa, atividades de todos os locais com o nome do local, choque entre locais); o deslocamento entre parques entra depois, quando a Babi disser os tempos. A alternativa "uma Escala única para todos os locais" seria uma reconstrução grande (Programação, Livro do Dia, publicação, avisos). **Ela vai continuar essa conversa (onde cada pessoa fica em cada local) na outra conta; não comece sem ela pedir.**
2. **Esperando a Babi:** "onde a pessoa trabalha no dia" + deslocamento entre parques (K); "pessoa em duas áreas" (Amanda e Antônio, depende de K); regra de "limitado" para a Fase 2 (semana e equilíbrio, migração 0088).
3. **Renomear "Escala do dia" para "Atividade do dia":** já trocado na aba da tela Escalas, no título da folha e na mensagem de erro da aba. **Não trocado** (decisão dela): Livro do Dia, Solicitações, Registro, avisos. Pergunte se quer tudo igual.
4. **Próximos itens do plano** (depois das chamadas): G tempo disponível (migração 0088 ou 0089), H copiar de outro dia, I formações no Livro do Dia, J menos cliques, Fase 2 (semana/equilíbrio), Fase 3 (relatório). Ver `docs/plano-mestre-escala.md`.
5. **Não visto na tela ainda:** a janela "Editar neste dia" a 1360 px e a Supervisão usando o botão; a folha de Snowland com a Acrobacia cortada por ensaio (a empresa de teste não tem esse dia) e a folha da Montanha (Guardião 1–8); a Escala do dia como Direção a 1360 e como Supervisão a 375; aparelho de verdade (toque, PWA); "Editar este texto" só foi conferido na tela, **não o PDF gerado**.
6. **Testes:** a bateria completa tem 1 arquivo que já falhava antes das mudanças: `restricao-horario.test.ts` (8 falhas, as mesmas com e sem o código novo; não foi investigado). Os demais que rodei passam (`escala-chamadas` 76, `escala-editar-atividade-no-dia` 32, `permission-matrix` 25, `escalas-dia` 100, `escala-horario-da-pessoa` 24, `escala-flexivel-e-prioridade` 44, resumo 17). Rode a bateria completa antes de cada promoção.
7. **Produção, só leitura:** conferir `DB_POOL_MAX=3` (ver `docs/quando-o-app-cai.md`, alerta EMAXCONN).

## 3. Decisões já tomadas (NÃO reabrir)

- **Chamadas:** várias por show; nome livre (sugestões Chamada, Aquecimento, Call do show); horário fixo ou "X minutos antes" (acompanha o horário da atividade); duração; "ocupa tempo" (gera choque, só avisa) ou "só informa"; vão as pessoas da atividade (no show, as do Livro do Dia; folga vence); aviso só dentro da convocação ao publicar (lembrete antes fica para depois); copiar para outras sessões; configurável no show, no bloco da Programação e na atividade só de hoje; máximo 8 por atividade; a chamada termina no máximo quando a atividade começa.
- **Folha/Escala:** "Elenco do dia" sem número; bloco de área mostra o nome da área; sem linha extra no PDF para horário cortado; chamada embaixo da atividade; chamada de show grande diz "Elenco do show: N pessoas"; "no show" e folga são uma lista só ("Pessoas de folga"); janela flexível diz só "Cada um cumpre dentro da janela"; posições numeradas em ordem de número.
- **Antigas:** no show = folga; resumo "Elenco do dia" a partir de 80% (mínimo 3); atividade específica ganha do geral cortando só o trecho que cruza; almoço = janela flexível; "Conferido" removido do app; a Escala abre por atividade; tipos renomeados (em produção); Mural continua aberto; a "grade pessoa × dia" e a Etapa 4 (experimentar grupos) descartadas até o primeiro mês real; Supervisão que só tem local encerrado vale como "área sem Supervisão".
- **Papéis:** Administração publica; Supervisão do local mexe na escala de pessoa de qualquer área (decisão de 25/10; fica visível quem mexeu); Direção só lê a operação (e age como Administração no Mural, Mensagens, Agenda e Tarefas); Elenco vê o que é dele.

## 4. Como trabalhar (máquina Windows, PowerShell, pnpm)

Siga `AGENTS.md`. Os comandos que funcionam aqui (todos a partir da worktree):

```powershell
# tipos
node ../../node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/bin/tsc -p tsconfig.json --noEmit    # em artifacts/api-server ou artifacts/web-admin
# schema (depois de mexer em lib/db/src/schema), em lib/db:
node ../../node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/bin/tsc -p tsconfig.json
# migração no banco de TESTE, em lib/db:
node --env-file=../../.env.test ../../node_modules/.pnpm/tsx@4.21.0/node_modules/tsx/dist/cli.mjs src/migrate.ts
# um teste da API, em artifacts/api-server (um arquivo por vez: o banco de teste tem poucas conexões; não suba servidor junto):
$env:MYASA_TEST_RUNNER="1"; $env:TEST_FILE="escala-chamadas.test.ts"; node --env-file=../../.env.test ./tests/run-tests.mjs
# teste do resumo, em artifacts/web-admin:
node ../../node_modules/.pnpm/tsx@4.21.0/node_modules/tsx/dist/cli.mjs --test src/components/escala/resumo-de-quem.test.ts
# build do site + verificação de nomes (regra D1), em artifacts/web-admin:
$env:PORT="3000"; $env:BASE_PATH="/"; node ../../node_modules/.pnpm/vite@7.3.3_@types+node@25.6_a3f39bdab8a01c2e0887457013ce58fe/node_modules/vite/bin/vite.js build --config vite.config.ts; node scripts/verificar-nomes-build.mjs
```

**Ver a tela com dados de verdade (empresa de teste, nunca a conta real):** (1) `node ./build.mjs` em `artifacts/api-server`; (2) carregue o `.env.test` no ambiente e rode `node dist/index.mjs` com `PORT=3095`; (3) rode o auxiliar de login `artifacts/api-server/scripts/entrar-teste-auxiliar.mjs` com `SENHAS_ARQUIVO=C:\Users\Usuario\Documents\MyASA\artifacts\api-server\scripts\empresa-de-teste.local.json` (porta 3998; ele devolve o login de uma conta `teste.*` sem mostrar a senha); (4) rode o site com `vite ... --host 127.0.0.1` com `PORT=3094` e `API_PROXY_TARGET=http://localhost:3095`; (5) no navegador embutido, abra `http://127.0.0.1:3094/`, busque `http://127.0.0.1:3998/?quem=teste.admin` e grave no `localStorage` as chaves `myasa_access_token`, `myasa_refresh_token`, `myasa_user`, `myasa_roles`, `myasa_capabilities`. Contas: `teste.admin`, `teste.direcao`, `teste.sup1` (Patinadores), `teste.sup2` (Bailarinos), `teste.elenco07` (Elenco). Locais de teste: Teatro (`d9c4bf2b-46f5-48e3-9038-0aefe09aa7ea`), Rinque, Piscina. A pasta de scratch da sessão antiga não existe mais: guarde seus próprios arquivos temporários na pasta que o sistema indicar. Pare os servidores (portas 3095, 3094, 3998) quando terminar.

**Dicas que custaram caro:**
- Heredoc com muitas aspas no Bash às vezes quebra; escreva arquivos com a ferramenta de escrever e rode um script Python curto para editar.
- No PowerShell 5.1 não existe `&&`; para os blocos que ela cola, use `;`.
- Commit por caminho (`git add <caminhos>`; `git commit -F arquivo`), mensagem em português contando o que estava errado e por que a mudança resolve, terminando com `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Outras sessões da usuária podem mexer no repositório principal: nunca inclua arquivo que não é seu.
- Toda tela nova: confira os 4 perfis (Administração, Supervisão, Direção, Elenco), 375 e 1360 px, janela com rodapé Cancelar/Salvar, Esc fecha, sem rolagem lateral, recusa com frase em português, Registro (`writeHistoryEvent`), e o que acontece depois de publicado.

## 5. Modelo de dados e arquivos principais (para não procurar)

- **Escala do dia** é montada na leitura por `artifacts/api-server/src/services/escala-dia.ts` (`montarEscalaDoDia`): blocos da Programação, do Livro do Dia, solicitações aprovadas, atividades manuais; depois **edições do dia (0087)**, **chamadas (0086)**, prioridade (específica corta o geral), folga vence, ajustes por pessoa (`escala_bloco_ajustes`), horário só de uma pessoa (`HORARIO`).
- Rotas: `artifacts/api-server/src/routes/escalas.ts` (chamadas no fim do arquivo; `/escalas/dia/horario`, `/escalas/dia/editar`, `/escalas/dia/saiu`, publicar/republicar). Chamadas: `services/escala-chamadas.ts`.
- Tela: `artifacts/web-admin/src/pages/escalas.tsx`; componentes em `components/escala/` (`chamadas-editor.tsx`, `editar-atividade-dialog.tsx`, `atividade-lote-dialog.tsx`, `resumo-de-quem.ts`, `atencao-do-dia.tsx`, `bloco-menu.tsx`...); folha impressa em `pages/print-day.tsx`; Livro do Dia em `pages/livro-do-dia.tsx`; Shows em `pages/shows.tsx`.
- Banco: `lib/db/src/schema/escalas.ts`; migrações `lib/db/drizzle/NNNN_*.sql` + rollback em `lib/db/drizzle/rollback/` + `meta/_journal.json` (a próxima livre é **0088**).
- Comandos de produção que ELA roda (nunca você): backup `lib/db/scripts/backup-producao.ts`; migração `lib/db/scripts/migrar-producao.ts --ensaiar` e `--aplicar --so=<nome>` (sempre a partir da pasta `lib/db` da worktree, com `--env-file=C:\Users\Usuario\Documents\MyASA\.env.producao`).
- Documentos: `docs/plano-mestre-escala.md`, `docs/desenho-chamadas-escala.md`, `docs/quando-o-app-cai.md`, `docs/backup-e-restauracao.md`.
