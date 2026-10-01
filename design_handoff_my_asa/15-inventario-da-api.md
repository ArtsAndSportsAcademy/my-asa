# Inventário da API — o que ele achou e o que fazer

Leitura de código feita em 15/09/2026, sem alteração. A API é montada sob `/api`.

## Resumo em uma linha

Existe muito mais do que o pacote supunha — 18 módulos com rotas reais. O problema não é
falta de funcionalidade: é que **quatro fundamentos que o pacote trata como obrigatórios não
estão de pé**, e nenhum deles aparece como erro no dia a dia.

---

## Os quatro graves

### G1 · Nenhuma rota tem teste de permissão

As 16 "verificações de segurança de perfis" **não fazem chamada HTTP**. Testam resolução de
perfil e projeção de dados — lógica pura. Nenhuma rota do sistema tem teste que prove 403.

O pacote diz, em `02-perfis-e-permissoes.md`: *"a permissão é validada no servidor, não
escondida na tela"*. Hoje isso é intenção, não fato verificado. Não sabemos se um MEM
autenticado consegue ler a ficha de outra pessoa ou salvar escala de outra área — e é
exatamente o tipo de falha que não aparece em uso normal, só quando alguém tropeça nela.

**Gravidade: a maior da lista.** Piloto com dado real de 40 pessoas, incluindo motivo de falta
e ocorrência.

### G2 · Rotas que apagam de verdade

`DELETE /api/users/:id` **apaga o usuário e dados vinculados**. A própria mensagem de erro da
rota recomenda desativar em vez de apagar — e a rota continua ali. O pacote é explícito:
*"nunca apagar a pessoa; o histórico dela é da operação"*.

Mesma coisa em Livro do Show (livro, cenas, blocos, posições, linhas), Escala, entrada de
escala, Livro do Dia, evento de agenda, atividade (a tabela tem `active`, a rota apaga),
categoria de biblioteca, evidência de tarefa.

Um clique errado e o histórico de uma temporada vai embora sem cópia.

*Exceção legítima*: as regenerações (`scales/:id/regenerate`, `daily-book/:id/regenerate`)
apagam filhos para recriar dentro de transação. Isso é o Bloco 1 funcionando — não mexer.

### G3 · O Registro é best-effort

As gravações de histórico usam `void …catch(() => {})`. Ou seja: **se a gravação do Registro
falhar, a alteração acontece e ninguém fica sabendo**. Não é atômico com a mudança.

Além disso, uma lista longa de escritas não grava Registro nenhum — inclui `POST /scales/generate`,
`POST /daily-book/generate`, quase toda a Agenda, Atividades, Avisos, Responsabilidades,
`PATCH /folgas/:id`, `PATCH /tasks/:id`.

E as escritas de Pessoas e Perfis gravam em `security_audit_log`, não no Registro operacional.
São duas trilhas diferentes; o pacote pede uma — quem, quando, o quê, antes, depois, motivo.
**Trocar perfil de alguém exige motivo registrado**, e isso precisa estar no mesmo lugar onde a
Direção vai olhar.

### G4 · Fuso horário

Várias rotas usam `toISOString()` para resolver datas. Isso é UTC. Em São Paulo, **entre 21:00
e a meia-noite, "hoje" no servidor já é amanhã.**

Este app é inteiro organizado por data: escala do dia, Livro do Dia, check-in por turno,
rodízio que soma 1 por dia. Um check-in às 21:30 de sábado pode cair no domingo. O contador de
rodízio pode somar no dia errado — e o rodízio é a divergência nº 1, que acabamos de consertar.

Precisa de uma função única de "hoje em America/Sao_Paulo" e todas as rotas usando ela. Está
espalhado em `my-day`, `operational-panel`, `insights` e ASA.

---

## O que falta de rota (tela não consegue funcionar)

| Falta | Bloqueia | Nota |
|---|---|---|
| **Personagem e PersonagemElenco** — tabelas existem, rotas não | 04 Personagens, 13 Shows | o Bloco 2 criou as entidades; nada as expõe |
| **Sessao** — tabela existe, rota não | 13 Shows, e o Bloco 3 por consequência | |
| **Ocorrência** — tabela e serviço existem, rotas não | 19 Check-in e ocorrências | o ciclo aberta → em análise → resolvida não tem como acontecer |
| **Áreas** — não existe tabela nem rota | 08 Áreas | há supervisor por grupo/operação, não por área |
| **Locais** — tabela `locations` existe, rota não; Operação guarda locais num campo JSON | 06 Locais | |
| **`AreaLocalSupervisor`** — não existe | escopo da Supervisão | **Bailarinos tem Victor em Snowland e Stephani em Acquamotion.** Sem isso, um dos dois escreve onde não devia |
| Conflito nos dois momentos | 13, 14 | detecção existe e é chamada em `scales/:id/entries`; falta em `show-books/:id/resolve`, `daily-book/generate` e `regenerate` |
| Painel com ocorrências | 16 Painel | `operational-panel` e `insights/check-ins` são separados; ocorrência não entra |
| Busca global | shell | existe busca de biblioteca e da ASA; não existe `/api/search` |
| Auto-publicação da escala | 15 Escalas | há `publishDeadline` no modelo, mas nenhum job. O único scheduler é de lembrete de tarefa |
| Reconhecimentos como módulo | 25 | hoje vive dentro de `/api/asa/recognitions` |

---

## Push: decidido — PWA, sem app de loja

Ele encontrou **push nativo via Expo para iOS e Android**, e `POST /api/notifications/device-token`
registra token móvel. **Esse app existiu e foi descontinuado** — exigia pagamento recorrente que
a operação não quer manter. Decisão confirmada em 15/09/2026: **web responsível instalável
(PWA)**, sem app de loja, sem conta de desenvolvedor, sem revisão da Apple.

Consequências:

- O push do Expo e `/api/notifications/device-token` são **código legado**. Não apagar
  (histórico), não construir nada em cima. Os tokens guardados não servem para Web Push — é
  outro mecanismo.
- Falta construir: manifest, service worker, inscrição Web Push (VAPID) e a rota que guarda a
  inscrição do navegador.
- **Instalar na tela de início é passo obrigatório do primeiro acesso**, não sugestão: no iPhone
  o push só funciona depois disso. O procedimento difere entre iPhone e Android — a tela 01
  precisa detectar qual e mostrar o certo.

---

## Ordem de trabalho recomendada

**Bloco 5 — integridade e segurança das rotas.** G1, G2, G3, G4. Nenhum acrescenta
funcionalidade; todos evitam perda de dado ou vazamento. Antes do piloto.

> **Bloco 5 aceito em 16/09/2026.** Migrações `0023_block5_lifecycle_flags` e
> `0024_formations_organization_scope`. Matriz HTTP real: **250 rotas × 5 perfis = 1.250
> chamadas autenticadas, sem falha** (G1). Desativação lógica no lugar de exclusão física (G2).
> Registro transacional em todos os módulos, **sem exceção best-effort** — deliveries e grade de
> folgas convertidos, com teste de rollback que força a falha do Registro e confirma que a
> alteração não persiste (G3). Datas operacionais em `America/Sao_Paulo` via
> `lib/operational-date.ts` (G4). Suíte: 168 asserts base + 14 do Bloco 5.
>
> **Dois vazamentos reais encontrados e corrigidos pela matriz** — a prova de que G1 valia a
> pena: `/api/check-ins`, `/api/check-ins/summary` e `PATCH /api/check-ins/:id` aceitavam
> operação fora do escopo; `POST` e resposta de `/api/supervisor-requests` consultavam ids fora
> da organização. Ambos em dado sensível (check-in e pedido de supervisão).
> `GET /api/show-books/:id` cross-org responde 404 sem revelar dado — anti-enumeração, correto.

**Bloco 6 — rotas que faltam.** Personagem, Elenco, Sessão, Ocorrência, Áreas, Locais +
`AreaLocalSupervisor`, conflito nos dois momentos, Painel com ocorrências.

> **Aceito em 17/09/2026.** Migrações `0025_block6_areas_and_http_entities` e
> `0026_block6_occurrence_lifecycle`. 33 rotas novas, 165/165 combinações rota/perfil,
> 192 chamadas HTTP reais. Suíte total **416 asserts**, 0 falhas (168 anteriores preservados).
>
> O caso que faltava está provado: **Victor salva escala de Bailarinos em Snowland e recebe 403
> no Acquamotion; Stephani, o inverso.** Também verificados: conflito sem bloqueio nos dois
> momentos, privacidade do Painel (agregado sem nome), e rollback quando o Registro falha.
>
> **Ressalva anotada, não impeditiva**: a cobertura por perfil é completa nas 33 rotas novas;
> nas 283 rotas antigas a varredura comprova 401 (sem sessão), e a autorização segue coberta por
> casos específicos — não por matriz exaustiva. Aceitável: as rotas antigas passaram pela matriz
> de 1.250 chamadas do Bloco 5. Revisitar se aparecer comportamento estranho de escopo em rota
> antiga.

**Bloco 7 — PWA e o que sobrou.** Manifest, service worker, Web Push com VAPID, busca global,
auto-publicação da escala.

O piloto de uma semana (`14-piloto-uma-semana.md`) precisa do Bloco 5 inteiro e da parte de
Ocorrência do Bloco 6. O resto pode entrar depois, com o app já em uso.
