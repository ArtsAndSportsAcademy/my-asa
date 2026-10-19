# Handoff da sessão de coordenação (19/10/2026)

Quem lê só este arquivo deve conseguir continuar. Leia antes o `AGENTS.md` (regras e crivo de 16
perguntas). Branch: `codex/myasa-novo`. Nunca merge na `main`. Tudo em português do Brasil.

## Qual é o seu papel

Esta sessão **não escreve a maior parte do código**. Ela acompanha. A pessoa que constrói o app abre outras
sessões para cada etapa e volta aqui para dizer "etapa X pronta". Você então:

1. confere no git se o commit existe, o que ele leva e se foi enviado (`git fetch`, `git log origin/codex/myasa-novo..HEAD`,
   `git status`);
2. confere no código ou nos testes o que a etapa disse ter feito, sem repetir o que ela disse;
3. registra a etapa no plano (`docs/plano-etapas-pos-revisao-2026-10-17.md`) e atualiza o quadro;
4. avisa quando duas sessões podem pisar nos mesmos arquivos, e quando um commit pode pegar arquivo de outra
   sessão (isso já aconteceu: a R3-A commitou, sem querer, a mudança do Mural que estava solta).

Quem constrói o app é a pessoa que conversa com você, e é ela que autoriza push e promoção. Não peça "pode
enviar" à Babi nem cite a Babi como quem libera; ela só é consultada para regra de negócio.

## Como a pessoa quer ser tratada

- Respostas curtas, em português simples, sem jargão. Explique decisões com o que acontece hoje, as opções e
  uma recomendação.
- Diga a verdade sobre o que foi verificado: "conferi no git" é diferente de "rodei o teste" e de "olhei na tela".
- Só commite os arquivos da sua parte, com mensagem longa em prosa (o que estava errado e por que a mudança
  resolve). Termine com `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- **Push e promoção só quando ela mandar.** Migração em produção é dela; você só aplica no banco de teste.
- Os soltos `.gitignore`, `artifacts/web-admin/package.json`, `pnpm-lock.yaml` e `skills-lock.json` aparecem
  modificados: ela disse que **não precisa commitar**. Deixe como estão.

## O que está feito

Etapas do plano de 17/10 (`docs/plano-etapas-pos-revisao-2026-10-17.md`), todas **enviadas e promovidas** em
produção, sem migração nova (a última é a 0074):

| Etapa | O quê | Commit |
|---|---|---|
| 0 | Revisão de 17/10 commitada | — |
| 1 | Cadastro de Operações (tela em Gestão, checklist de ativação) | `c404bdf` |
| 2 | Gerar o mês rápido | `00349da`, `bf14d94` |
| 3 | Ciclo por minuto e check-in em paralelo limitado | `50aeb34` |
| 4 | Lote da Escala numa transação só; edição de pessoa por `PUT /users/:id/cadastro` (só Administração; e-mail fora) | `fb26edd` |
| 5 | Escala no celular: cartão por pessoa, menu "Mais", respiro do botão da ASA | `ab29bd3` |
| 6 | Hora do cartão do Livro do Dia pela Programação | `7561f3d` |
| 7 | Cores viram tokens CSS; formato de erro `{error: CODIGO, message}`; falha de rede não vira "vazio" | `32d5a91`, `694359c`, `595fa12` |

Também a migração 0074 (formato do palco no show), com API e site, promovida.

## Decisões de 19/10/2026

1. **Mural continua aberto:** todo mundo publica, edita e remove. Nada muda.
2. **Reconhecimento é só para os colegas:** quem publica sai da lista; se só sobrar a própria pessoa, 400 com
   "Reconhecimento é para os colegas. Escolha outra pessoa." Está em `communication-hub.ts`, no commit
   `4502c06` (a R3-A levou junto). Testes verdes: `mural-avisos`, `mural-aberto`, `grupo-c-communication`.
3. **Todo pedido de folga passa pela Supervisão da área,** com o mapa do mês publicado ou não. A Administração
   só decide quando a Supervisão não respondeu e o prazo (N dias, configurável) abriu, ou quando a área não tem
   Supervisão. O que a Administração registra pelo calendário (`POST /leave-calendar`) continua nascendo
   aprovado. Isso reverte o trecho "Mês ainda não publicado" do áudio da Administração de 16/10/2026: ela deve
   ser avisada. Detalhes e prompt em `docs/plano-folga-sempre-passa-pela-analise-2026-10-19.md`. Resolve também
   a pergunta do `decided_by` (a própria pessoa aparecia como quem decidiu).
4. **Flash da Escala ao trocar de local:** corrigir. A correção está em `escalas.tsx` (um `useEffect` que
   esvazia `dia` e `minha` quando `localId` ou `date` mudam).

## ATUALIZAÇÃO (mais tarde em 19/10) — leia primeiro, vale mais que o resto

As sessões da R3-B, da regra de folga e da Etapa 8 terminaram. O que mudou desde o texto abaixo:

- **Commits locais, sem push (4):** `4f4742a` (folga: todo pedido nasce pendente), `6b63769` (este handoff),
  `5669e9d` (Etapa 8: corrige pool esgotado e FK nos testes) e `957eaa6` (handoff da Etapa 8, seção 1-b).
  O diretório de trabalho está limpo para arquivos já versionados.
- **`5669e9d` levou mais do que devia.** Ele varreu tudo o que estava solto: `.gitignore`, `package.json` do
  web-admin, `pnpm-lock.yaml`, `skills-lock.json` (a pessoa tinha dito que **não** queria commitar esses) e
  também o `escalas.tsx` com a correção do flash da Escala, que **continua sem conferência na tela**. A
  pessoa precisa decidir se aceita assim ou se separa antes do push.
- **`4f4742a` (folga) e `5669e9d` ainda não foram conferidos por esta sessão** quanto ao conteúdo; só o git
  foi lido. Confira o que cada um leva e os testes antes de registrar no plano.
- **Bateria da Etapa 8:** a primeira passada (`bateria-resultados.txt`) deu 61 de 71 arquivos. Depois, cada
  arquivo que falhou foi rodado isolado: `fase-e-cadastro`, `folga-roteamento`, `folgas-equipe`,
  `shift-checkins`, `fase-e-ciclo`, `ciclo-paralelo` e `permission-matrix` passam (o handoff
  `docs/handoff-2026-10-19.md`, seção 1-b, lista os cinco últimos). **Sem confirmação nos papéis que li:**
  `block5-integrity`, `fase-b-regressoes` e `fase-c-perfil-regras`. Rodar esses três isolados. Regra: um arquivo
  por vez, `ciclo-paralelo` e `permission-matrix` nunca juntos (esgotam o pool de 15 conexões).
- **Arquivos soltos na raiz** (resíduo de depuração, sem commit): `bateria-resultados.txt`,
  `ciclo-paralelo-debug.txt`, `perm-debug.txt`, `rerun-correcoes.txt`, `rerun-correcoes2.txt`,
  `rerun-falhas.txt`. Não commitar; perguntar se pode apagar ou pôr no `.gitignore`.

### PROBLEMA GRAVE: a rodada 3 e o plano da revisão 3 sumiram do branch

A história do `codex/myasa-novo` foi reconstruída (provavelmente para poder enviar `c404bdf`). Dois commits
antigos **não estão mais no branch**, só no branch local `backup/rodada3-e-etapa2-sem-enviar`:

- `f3cceb2` **"Rodada 3 da revisão: isolamento entre casas, folgas, ocorrências, Painel e limites do Mural"**.
  É código, não documentação: `routes/folgas.ts`, `occurrences.ts`, `show-book.ts`, `daily-book.ts`,
  `operational-cycle.ts`, `communication-hub.ts`, `web-admin/.../operational-cycle.tsx` e o teste
  `folga-dia-dentro-do-intervalo.test.ts`. Conferi: o teste **não existe** no branch atual e o patch
  **não está aplicado**. Ou seja, o branch enviado ao GitHub e a produção **não têm** essas correções, entre
  elas, provavelmente, a do intervalo de folga invertido (a que motivou a consulta R3-D; não li o diff para confirmar).
- `0536b7e` o plano `docs/plano-etapas-revisao-3-2026-10-18.md` (o arquivo existe no disco, mas está sem
  commit).

Os outros commits do backup têm equivalentes no branch atual (`git cherry` marca com `-`, exceto `e7668c0`, que foi reaplicado como `2739b84` com diferenças): Operações e
Gerar o mês foram reaplicados com outros hashes.

**O que fazer (com a pessoa decidindo):** trazer o `f3cceb2` para o branch atual com `git cherry-pick f3cceb2`.
Haverá conflito provável em `operational-cycle.ts` (a regra de folga mexeu lá em `4f4742a`) e em
`daily-book.ts`. Resolver, rodar `folga-dia-dentro-do-intervalo`, `folga-roteamento`, `folga-analise`,
`folgas-equipe`, `permission-matrix` e `mural-aberto`, e só então commitar. Depois commitar o plano
`plano-etapas-revisao-3-2026-10-18.md`. **Não apagar o branch de backup** até isso estar feito e testado.
A R3-D (consulta de folgas invertidas em produção) continua valendo, e provavelmente vai achar linhas, porque
a correção ainda não foi para produção.

## Estado do git no momento em que este arquivo foi escrito (SUPERADO pela atualização acima)

- Enviado ao GitHub: tudo até `8ce7965`.
- **Local, sem push:** `4f4742a` "Folga: todo pedido nasce pendente, sem caminho de prioridade". É a sessão da
  decisão 3. Não conferi o que ele leva, nem testes, nem tela. **Confira antes de dizer que está pronto.**
- Sem commit, de sessões em andamento (não são seus; pergunte de quem são antes de tocar):
  `routes/users.ts`, `services/operational-jobs.ts`, `services/shift-checkins.ts`,
  `tests/folgas-equipe.test.ts`.
- Sem commit e **seu**: `artifacts/web-admin/src/pages/escalas.tsx` (decisão 4). **Não foi conferido na tela.**
  Quando a pessoa disser que olhou e está certo, commite só esse arquivo.
- Pastas fora do git, que ela não quer versionar: `.pnpm-store/`, `output/`, `.playwright-mcp/`,
  `my-asa-main.zip`, `Nuevo Documento de texto.txt`, `.agents/skills/`, `.claude/` estão no `.gitignore`
  (alteração do `.gitignore` ainda sem commit). `docs/apresentacao/` **vai ser commitada só na entrega**.
  `artifacts/brand/` e os testes do Playwright (`artifacts/web-admin/tests/`, `playwright.config.ts`): sem
  decisão ainda.

## O que está pendente

- [ ] **Etapa 8 (parcial).** O handoff dela é `docs/handoff-2026-10-19.md`: revisão de telas nos quatro perfis em
  modo amostra, `permission-matrix` limpo, mas **a bateria completa (cerca de 60 arquivos) não tinha rodado**.
  A pessoa está rodando agora. Quando ela trouxer o resultado, separe defeito do código de limite do banco de
  teste (`EMAXCONNSESSION`), e registre a Etapa 8 no plano com o que passou, o que falhou e o que não rodou.
  Falta também a revisão com a empresa de teste (`docs/empresa-de-teste.md`), não só modo amostra.
- [ ] **R3-A:** feita e enviada (`4502c06`), mas **ainda não registrada** em `docs/plano-etapas-revisao-3-2026-10-18.md`.
- [ ] **R3-B:** a pessoa está fazendo (roteiros que pararam por erro: Tarefas até a aprovação, responsabilidades,
  restrição de horário, ASA ao vivo). Scripts fora do repositório. Se ela corrigir código, não misture com o que
  a bateria testa.
- [ ] **R3-C:** decidida (itens 1 e 2 acima).
- [ ] **R3-D** (dela): consulta SQL só de leitura em produção para folgas ativas com intervalo invertido. O SQL do
  plano tem nomes de tabela e colunas a ajustar; **peça a consulta antes de ela rodar e confira com
  `lib/db/src/schema`**. Se aparecer linha, não corrigir na mão: preparar script de correção com rollback.
- [ ] **R3-E** (dela): conferir no aparelho Perfil, PDF da Biblioteca, teclado no Livro, mapa do palco, push e
  impressão; e, das Etapas 3 a 6, o menu "Mais", o cartão por pessoa, o botão da ASA e o cartão com dois
  horários do Livro.
- [ ] **Promoção** (dela, quando mandar): API primeiro, depois site, sem migração. O que está enviado e ainda
  não promovido: `4502c06` (API: 404 de id inválido, textos da Agenda, reconhecimento só para colegas),
  `1080df2` (site: cartões do Livro antes dos detalhes), e o que a sessão da folga trouxer (`4f4742a`, API e
  site). Antes de subir o site: `node scripts/verificar-nomes-build.mjs` (regra D1).
- [ ] **Revisão tela a tela que nunca foi feita** (com o crivo): Folgas e Solicitações, Mapa do mês, Grupos de
  folga. A regra real está em `docs/regras-de-folgas.md`.
- [ ] **Revisão 4:** oito pontos descritos no fim de `docs/plano-etapas-revisao-3-2026-10-18.md` (Registro,
  Perfil e senha, Biblioteca, Cadastros pela tela, desktop da Supervisão e da Administração, concorrência,
  notificações, bateria completa).
- [ ] **A conferir:** o handoff da Etapa 8 lista as migrações 0067 a 0073 como "só no banco de teste, para
  promover", mas o `AGENTS.md` diz que da 0000 à 0074 já estão em produção. Provavelmente texto antigo. Antes
  de qualquer promoção, confirme com a pessoa (só leitura em produção).
- [ ] **Acquamotion** não tem vagas de personagem (planilha "a definir"); Livros do Dia de lá nascem vazios, o
  que não é defeito. **Buona e Bella** têm filas definidas e vagas a criar.

## Cuidados que valem

- Duas sessões não mexem nos mesmos arquivos. A regra da folga toca `operational-cycle.ts` e `asa.ts`; a R3-B
  não deve tocar neles.
- O banco de teste é lento (5 a 12 s por escrita). Suíte parecendo travada costuma ser só isso. Rode em segundo
  plano o que passar de 2 minutos.
- Comandos que funcionam nesta máquina estão no `AGENTS.md` (os `pnpm` não resolvem; use os caminhos de `node ...`).
- Não escreva senha, token ou `.env` em lugar nenhum. Em produção, só leitura.
