# Fase C — entrega (30/09/2026)

Plano de lançamento: <https://claude.ai/artifact/SADbLpDDWSgQCr7UitJ64m>, Fase C "Construir o que falta".
Feito por Claude (sessão de Escalas/Livro do Dia). **Não toquei na ASA** (`routes/asa.ts`,
`services/asa-*`, `global-asa-assistant.tsx`, `pages/admin/asa.tsx`). C8 (menores) e C9
(Reconhecimentos) seguem bloqueados pela decisão A7; C10 (ASA) é do Codex.

## Resumo

| Item | O que foi feito |
|---|---|
| C1 · Meu Dia | Tela 17 real nos quatro perfis, montada da Escala publicada do dia (`GET /api/meu-dia`). Elenco: seus blocos, botão de check-in, folga, tarefas, pedidos. Supervisão: check-ins em falta da área, ocorrências, áreas de amanhã não prontas. Administração: Escalas de amanhã sem publicar, responsabilidades sem dono, folgas, check-ins em falta. Direção: cobertura por local e ocorrências só em número, sem nomes. Mural com as 3 últimas publicações que a pessoa pode ler |
| C2 · Aviso de Escala publicada | Publicar avisa cada convocado. Republicar avisa só quem teve o horário alterado, entrou ou saiu. Folga e Administração não recebem. Deduplicado por versão |
| C3 · Lembrete e impressão | Lembrete "Check-in do dia" 30 min antes do primeiro bloco da pessoa, lido da Escala do dia; não chega para quem já fez check-in. Folha do camarim `/imprimir?local=&data=` refeita a partir de `/api/escalas/dia`, com marca RASCUNHO quando a Escala não está publicada |
| C4 · Perfil (tela 28) | Nome de uso, telefone, e-mail, "quem vê" telefone/e-mail, mudar senha, sessões abertas + "encerrar as outras", Sair. Tudo no Registro |
| C5 · Redefinir senha | Administração, em Pessoas → Editar → "Redefinir senha", com motivo obrigatório. Gera senha provisória legível (`abcd-2345`), mostrada uma vez; obriga a troca no próximo login; encerra todas as sessões da pessoa |
| C6 · Registro | Tela real para Administração e Direção: busca, período, quem fez, assunto; lista por dia; cada item abre "antes → depois" campo a campo e mostra o motivo |
| C7 · Escalas, rodada 2 | Itens da rodada 2, detalhados abaixo |

### C7 em detalhe

O Codex já tinha feito o ajuste de célula com Registro, a confirmação da escala e as rotas
`/escalas/dia/ajustes` e `/escalas/:id/confirmar`, com testes. Completei:

- Cartão "Mesma pessoa em dois lugares": um cartão por par de blocos (ex.: ALMOÇO × MUSICAL),
  com as pessoas dentro, em vez de um cartão por pessoa. Cada pessoa tem "Tirar de {bloco}", que
  usa o mesmo ajuste de célula. O botão só aparece para quem pode ajustar aquela pessoa. Bloco de
  show não tem botão: "tirar do show é no Livro do Dia".
- A coluna Horário mostra só o horário.
- O aviso de blocos vazios é uma frase ("6 blocos sem ninguém"). A lista abre ao tocar, cada item
  com "Ajustar".
- Na amostra, ALMOÇO tem regra `todos`. A folga de exemplo passou para a Sofia (Patinadores),
  para aparecer na revisão da Deborah; a amostra de Folgas foi trocada junto.
- Elenco: links "Informar ausência" → `/check-in` e "Pedir troca" → `/folgas`. O rodapé diz
  "você ainda não confirmou" ou "confirmada às HH:MM". O texto "horários de hoje" agora segue o
  dia aberto (hoje/amanhã).
- O molde "Natal" da amostra tem a etiqueta "dado de exemplo".

## Achados de segurança corrigidos no caminho (importante)

1. **Hash de senha no Registro.** `PATCH /users/:id` e `POST /users` gravavam a linha inteira da
   pessoa como antes/depois, com `passwordHash`. Correção central em `writeHistoryEvent`
   (`lib/history-helper.ts`): `semSegredos()` tira `passwordHash`, `tokenHash`,
   `refreshToken`, `accessToken` e campos de senha do antes/depois e do metadata. Isso vale para
   qualquer rota. A leitura também filtra, para as linhas antigas.
   **O banco do piloto provavelmente já tem hashes em eventos antigos.** Não mexi nele (A8 exige
   autorização). A leitura já esconde esses campos, mas o dado continua lá até uma limpeza
   autorizada.
2. **Registro sem recorte de organização.** `GET /history`, `GET /history/:id` e as narrativas
   devolviam eventos de **todas** as organizações do banco. Agora são sempre recortados pela
   organização de quem pede. Evento antigo sem `org_id` entra pelo ator da organização.
3. **Registro com o perfil errado.** A Supervisão lia e a Direção não. Agora só ADM e DIR, como
   manda `12-seguranca-antes-do-lancamento.md`. Criar e editar narrativa é só da Administração.
4. **Trocar senha não encerrava outras sessões nem entrava no Registro.** Agora é uma transação só:
   troca a senha, encerra os outros aparelhos (o aparelho atual continua) e grava no Registro.
5. **Tela "Crie sua senha" (`force-password-change.tsx`).** Agora manda o `refreshToken` do
   aparelho, para a pessoa não ser derrubada logo depois de criar a senha.

## Para o Codex: contratos novos

1. **`GET /api/meu-dia`.** Devolve o `MeuDia` montado em `services/meu-dia.ts`
   (`montarMeuDia(actor, perfil, now)`). O `/my-day` antigo ficou intacto.
2. **Avisos de Escala.**
   - `publicarOuRepublicar` (`routes/escalas.ts`) enfileira `scale.published` e
     `scale.republished` por pessoa, com `enqueueNotification(tx, …, { deduplicationKey:
     "escala:{id}:v{versão}:{pessoa}" })`.
   - O Registro da publicação guarda `convocacao` (pessoa → blocos) e `avisados`. A
     republicação compara a convocação com a da última publicação (`pessoasAfetadas`).
   - **Teste que publica Escala precisa apagar `notification_outbox` antes de
     `user_notifications`** (ajustei o cleanup de `escalas-dia.test.ts`).
3. **Lembrete.** `enqueueEscalaReminders()` em `services/operational-jobs.ts` roda a cada minuto,
   antes de `reconcileDueCheckIns`. A deduplicação é `escala-checkin:{escala}:{data}:{pessoa}`.
4. **Senha e sessões** (`routes/users.ts`).
   - `POST /users/me/password` recebe `{ currentPassword, newPassword, refreshToken }`. O
     `refreshToken` é o do aparelho que continua. Responde `{ ok, sessoesEncerradas }`. Conta sem
     senha → 409 `NO_PASSWORD`.
   - `GET /users/me/sessions` → `{ abertas }`.
   - `POST /users/me/sessions/encerrar-outras` `{ refreshToken }` → `{ sessoesEncerradas }`.
   - `POST /users/:id/password-reset` `{ reason }`. Só ADMIN, não serve para a própria conta,
     motivo obrigatório. Responde `{ senhaProvisoria, sessoesEncerradas }`.
5. **Registro** (`routes/history.ts`).
   - `GET /history` aceita `q` (texto), `action` (prefixo), `entityType` (um ou vários,
     separados por vírgula), `entityId`, `actorId`, `dateFrom` e `dateTo`. Responde
     `{ events, count, hasMore }`.
   - Só ADMIN e DIR, sempre na organização de quem pede.
6. **Front.**
   - `pages/perfil.tsx` exporta `useSignOut()`, e o shell importa de lá.
   - `lib/sem-rede.ts` → `semRede(err)`. Queda de rede vira `TypeError`, não `ApiError`
     status 0. O aviso de "sem conexão" do Meu Dia nunca aparecia por causa disso.
   - `PwaSetup` ganhou `embedded`, para ficar dentro do cartão do Meu Dia sem título duplicado.
     O cartão some quando os avisos já estão ativos no aparelho.

## Arquivos alterados

- **API**
  - `services/escala-dia.ts`: `convocacaoPorPessoa` e `pessoasAfetadas`
  - `services/meu-dia.ts` (novo)
  - `services/operational-jobs.ts`
  - `routes/escalas.ts`: avisos na publicação
  - `routes/my-day.ts`: `/meu-dia`
  - `routes/users.ts`: senha, sessões, redefinição
  - `routes/history.ts`: reescrita das guardas e dos filtros
  - `lib/history-helper.ts`: `semSegredos`
- **Testes**
  - novos: `fase-c-escala-avisos` (17), `fase-c-meu-dia` (22), `fase-c-perfil-senha` (35) e
    `fase-c-registro` (21)
  - registrados em `run-tests.mjs`
  - ajustado: cleanup de `escalas-dia.test.ts`
- **Front**
  - novas: `pages/meu-dia.tsx` + `.css`, `pages/perfil.tsx` + `.css`, `pages/registro.tsx` +
    `.css`, `lib/sem-rede.ts`
  - `pages/print-day.tsx` (refeita)
  - `App.tsx`: rota `/imprimir`
  - `pages/escalas.tsx` + `.css`: C7 e o link "Imprimir o dia"
  - `pages/cadastros.tsx` + `.css`: redefinir senha
  - `pages/force-password-change.tsx`
  - `components/pwa-setup.tsx`
  - `lib/review-escala.ts` e `pages/operational-cycle.tsx`: amostra
  - `index.css`: impressão
- **Shell (`shell-foundation.tsx`, compartilhado; mudanças pequenas)**
  - Meu Dia, Perfil e Registro renderizam as telas novas.
  - `ProfilePage` e `useSignOut` saíram do arquivo.
  - A saudação genérica e o botão falso "Já instalei" foram removidos.
  - `InstallPrompt` passou a instalar primeiro e ativar avisos depois.

## Testes (banco de teste, `.env.test`)

- Novos, todos com mutação (quebrar a regra de propósito e ver o teste falhar, depois
  restaurar):
  - avisos: publicar sem avisar ou republicar avisando todos → falha
  - Meu Dia
  - senha: redefinição sem exigir ADMIN; "encerrar outras" derrubando também este aparelho;
    Registro sem filtro de segredo → falha
  - Registro: sem recorte de organização, perfis antigos ou leitura sem filtro → falha
- Suíte completa rodada depois das mudanças. Passaram:
  - block1–7
  - permission-matrix: 355/355 rotas protegidas, 0 falhas, 23 verificações
  - daily-book-*, logical-removal, scale-logical-removal
  - escalas-dia: 54
  - grupo-b: 17
  - grupo-c: 98
  - agenda: 5
  - asa-command-engine, asa-proposal-state e asa-memory-policy
  - asa-memory-http: 37
  - library-access
  - fase-b: 28
  - os quatro da fase C
- **Falha: `asa-actions-http`.** É do Codex e já falhava na auditoria. A verificação que cai é o
  texto da ASA para "alterar o prazo" de tarefa. Não mexi em arquivo da ASA.
- Typecheck da API e do front passando.

## Conferido no navegador (sessão real gerada no banco de teste, sem digitar senha real)

- **Meu Dia**
  - Julia vê os blocos dela e "Check-in feito às 10:17".
  - Deborah vê "7 pessoas da sua área ainda não fizeram check-in".
  - Cris vê a cobertura de Snowland (12%). Barbara vê "15 check-ins em falta".
  - No celular (375 px), sem rolagem lateral. Ajustado: linhas da grade, espaço em branco e
    cartão de instalação duplicado.
- **Perfil (Julia)**
  - "encerrar as outras" derrubou a outra sessão.
  - Telefone e "só a gestão" salvos no servidor e no Registro.
- **Pessoas (Barbara)**
  - Redefinir a senha da Julia mostrou a senha provisória uma vez.
  - O Registro mostrou o evento com o motivo, sem hash.
- **Registro**
  - Barbara vê 23 eventos do dia, agrupados.
  - "antes → depois" do telefone e da visibilidade estão legíveis.
  - Cris (Direção) lê. Deborah (Supervisão) recebe 403.
- **Escalas (amostra)**
  - Supervisão: cartões de conflito agrupados; "Tirar de ALMOÇO" só para Patinadores; tirar a
    Carol baixou o cartão de 18 para 17 pessoas.
  - Sofia aparece com "FOLGA — DIA TODO".
  - Elenco: links, "Confirmar escala" → "Ciente às 16:55" e rodapé "confirmada às 16:55".

## Segunda parte (decidido pela dona do produto em 30/09)

Respostas às decisões 1–3 abaixo:

1. **O lembrete de check-in ficou ajustável pela Administração**: 15, 30 ou 60 min antes do primeiro
   bloco. Fica no Perfil da Administração → "Regras da organização". O padrão é 30.
2. **O Perfil ficou completo conforme a tela 28.**
   - Três níveis de visibilidade: telefone/e-mail em só gestão · meu grupo · toda a ASA.
     Aniversário em não aparece · só na lista · mural no meu dia.
   - Silêncio noturno da pessoa. A casa define o padrão, 22h–06h / 23h–07h / sem silêncio.
   - Lista "Como o My ASA te avisa", só leitura.
   - Foto de perfil.
   - Aniversários no alto do Mural e no Meu Dia, sempre só com dia e mês.
3. **ALMOÇO em turnos.** Na amostra, virou três blocos por área (11:20 Bailarinos, 12:00 Produção,
   13:10 Patinadores). No sistema real não precisa de código: cada turno é um bloco ALMOÇO na
   Programação, com regra área ou pessoas.

### Contratos novos

- **Migração `0049_perfil_privacidade_silencio`**, aplicada **só no banco de teste**. O piloto
  precisa de autorização (A8). Traz:
  - `users.privacidade` (jsonb `{tel, mail, bday}`, preenchido a partir de `contact_visibility`)
  - `users.silencio` (jsonb ou null)
  - `organizations.regras` (jsonb `{silencio, lembreteCheckinMin}`)
  - tabela `user_photos` (bytea, RLS ligado, sem grant público)
  - rollback em `drizzle/rollback/0049_…down.sql`
- **`services/regras-casa.ts`**
  - `regrasDaOrganizacao`
  - `pushEsperaAte(input, now)`: devolve até quando o push espera, ou null
  - `atravessaSilencio`: prioridade `CRITICAL` e `checkin.shift_reminder` sempre passam
- **Outbox (`processNotificationOutbox`).** O aviso vai para o app na hora. Durante o silêncio, só
  o push volta para `pending`, com `dueAt` no fim da janela. Não duplica o aviso no app.
- **Republicar a Escala do próprio dia usa `priority: CRITICAL`** (troca de última hora atravessa o
  silêncio). Republicar outro dia usa `IMPORTANT`.
- **Lembrete.** `enqueueEscalaReminders` lê `lembreteCheckinMin` da organização.
- **Rotas (`routes/perfil.ts`)**
  - `GET/PATCH /organization/regras`: o PATCH é só ADMIN e grava no Registro.
  - `PATCH /users/me/preferencias` `{ privacidade?, silencio? | null }`: null volta ao horário
    da casa. Grava no Registro e mantém `contactVisibility` coerente.
  - `PUT /users/me/photo` (jpeg/png/webp, até 1 MB) e `DELETE /users/me/photo`. Ambos
    desativam a foto anterior, sem apagar.
  - `GET /users/:id/photo`: mesma organização.
  - `GET /mural/aniversarios` → `{ hoje, semana }`, sem ano.
- **Vazamento corrigido em `GET /api/users` para Elenco.** O Elenco recebia telefone e e-mail de
  todos os colegas da área, ignorando o "só a gestão". Agora usa `colleaguePerson(u, viewerId)`.
  `supervisorPerson` também não leva mais o `silencio` de ninguém.
- **Para o Codex (ASA).** `routes/asa.ts` monta marcos de aniversário (`BIRTHDAY`) lendo
  `birthDate` direto.
  - Precisa respeitar `users.privacidade.bday`: não publicar quando for `off`, nem quando for
    `lista`.
  - Nunca mostrar o ano.
  - Não mexi no arquivo.

### Testes

- `fase-c-perfil-regras`: 45 verificações.
- Mutação:
  - outbox ignorando o silêncio → 2 falhas
  - lembrete fixo em 30 → 1 falha
  - colega vendo tudo → 2 falhas
  - "só na lista" subindo no Mural → 1 falha
- Também passaram de novo:
  - fase-c-perfil-senha: 35
  - meu-dia: 22
  - escala-avisos: 17
  - registro: 21
  - permission-matrix: 363/363 rotas, 0 falhas
  - grupo-c: 98
  - block7: 76
  - escalas-dia: 54
  - fase-b: 28
  - profile-authorization: 16
- `profile-authorization` falhou primeiro. O fixture antigo só tinha `contactVisibility`.
  Corrigido: linha sem `privacidade` herda o nível do campo antigo.
- **Navegador**
  - Barbara, Perfil: "Regras da organização" → "15 min antes" salvou no servidor, a lista mudou
    para "15 min antes do seu primeiro bloco" e entrou no Registro. Voltei para 30.
  - Escalas (amostra): três turnos de almoço (6, 4 e 14 pessoas) e nenhum cartão
    "ALMOÇO × MUSICAL".
  - Mural (amostra): faixa de aniversários no topo.

## Decisões que ficaram para a dona do produto

As antigas 1 (horário do lembrete), 2 (Perfil completo) e 4 (ALMOÇO) foram resolvidas na segunda
parte, acima. Seguem abertas:

1. ~~Limpeza de hashes antigos no Registro do piloto~~: não é necessária, o banco do piloto está vazio.
2. ~~Aplicar a migração 0049 no piloto~~: feito, junto com as outras 12 pendentes (ver abaixo).
3. **Ano de nascimento — decidido em 30/09.** O cadastro continua guardando dia, mês e ano. As telas
   mostram só dia e mês (Mural, Meu Dia, Perfil), como já está implementado.

## Banco do piloto (MYASA-piloto, us-west-2): atualizado em 30/09, com autorização da dona do produto

- O projeto estava pausado no Supabase. Ela restaurou o projeto e confirmou que é o que o grupo vai
  usar.
- Antes: 37 migrações aplicadas, 13 pendentes (0037 a 0049), banco vazio (0 pessoas, 0
  organizações) e nenhum hash no Registro. A limpeza de hashes não é necessária.
- Aplicadas as 13 com `lib/db/src/migrate.ts`. Resultado:
  - 50 de 50, nenhuma pendente
  - colunas do Perfil presentes
  - regra padrão da casa: 22h–06h e lembrete de 30 min
  - RLS ligado nas tabelas novas
- `pnpm --filter @workspace/db run migrate` tentou reinstalar dependências e parou em
  `ERR_PNPM_IGNORED_BUILDS` (esbuild). Rodei o mesmo script direto com o `tsx` do
  `node_modules`.
## Estado do banco de teste

- Organização "Auditoria 2026-09-30T13:06" restaurada: Julia sem senha e sem troca obrigatória;
  telefone e visibilidade de volta.
- Todas as sessões geradas foram revogadas.
- Os scripts temporários (`artifacts/api-server/.audit-tmp`) foram apagados.
- Uma organização de teste do `escalas-dia` ficou para trás de uma rodada que falhou no cleanup,
  antes do ajuste. Não afeta outras rodadas.
