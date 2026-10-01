# Fase D — entrega em andamento (30/09/2026)

Plano: <https://claude.ai/artifact/SADbLpDDWSgQCr7UitJ64m>, Fase D "Segurança e qualidade". Não toquei
na ASA.

## D1 · Nomes reais fora do código público — feito

- **Antes:** o build de produção tinha **260 ocorrências de 51 nomes** do elenco, com nomes
  completos. O `dados-de-exemplo.json` ia inteiro para o navegador, e havia nomes fixos no código.
- **Agora:**
  - Um plugin no `vite.config.ts` (`semDadosDeExemplo`) troca, **só no build**, todo import do
    `dados-de-exemplo.json` por uma versão vazia com o mesmo formato. A amostra local
    (`?amostra=1`, em desenvolvimento) continua com os nomes.
  - Os nomes fixos da revisão (quem faz cada perfil na amostra, a folga de exemplo, quem marca área
    pronta) foram para `src/lib/amostra.ts`, dentro de `import.meta.env.DEV`. O minificador corta
    esse trecho no build.
  - Os marcadores "Mariela" e "Carol" do `PageArchetype`, no shell, viraram texto neutro.
  - `scripts/verificar-nomes-build.mjs` roda no fim do `pnpm run build` do web-admin e **faz o
    build falhar** se algum nome do elenco aparecer em `dist/public`.
- **Conferido:**
  - Com a proteção, o build tem 0 nomes em 40 arquivos.
  - Desligando a proteção de propósito, a verificação acha 51 nomes e sai com erro.
  - A amostra local segue funcionando: Escalas com as pessoas e a Sofia de folga.
- **Para o Codex:** tela nova que use o `dados-de-exemplo.json` não precisa de nada, o plugin já
  cobre. Nome de pessoa escrito direto no código precisa ficar dentro de `import.meta.env.DEV`
  (ou em `lib/amostra.ts`); senão o build quebra.

## D2 · Primeira Administração sem apagar o banco — feito

- **Antes:** o único caminho era `RESET_PROD_DB=1`, que dava `TRUNCATE` em **todas** as tabelas e
  criava um "Administrador" genérico.
- **Agora:**
  - Comando `pnpm --filter @workspace/api-server run criar-primeira-administracao -- --organizacao "…" --operacao "…" --nome "Nome Completo" [--nome-de-uso "…"] [--email …]`
    (`scripts/criar-primeira-administracao.ts` → `src/services/primeira-administracao.ts`).
  - Cria a organização e a operação se não existirem, ou usa as que existem pelo nome.
  - Cria a pessoa com perfil ADMIN e senha provisória legível, mostrada uma vez, com troca
    obrigatória no primeiro login.
  - Grava no Registro, sem a senha. Tudo numa transação.
  - **Recusa** se a organização já tiver Administração ativa: roda uma vez só.
  - `RESET_PROD_DB=1` foi desligado (`lib/bootstrap.ts`). Agora só registra um erro no log e não
    apaga nada. O `.env.example` foi atualizado.
- **Teste `fase-d-primeira-administracao`: 9 verificações.**
  - Cria sem apagar nada e recusa na segunda vez.
  - Usa organização e operação que já existem, sem tocar em quem já estava cadastrado.
  - Login com a senha provisória pede a troca.
  - `RESET_PROD_DB=1` não apaga nada.
  - Mutação (tirar a checagem de Administração existente) → 1 falha.
  - A mutação do reset antigo **não** foi feita, porque apagaria o banco de teste.
- Também passaram: permission-matrix (363/363 rotas, 0 falhas), fase-b (28) e perfil-senha (35).

### Banco de produção em São Paulo (01/10)

A dona do produto decidiu por Supabase em São Paulo + Vercel (ver `docs/producao/`).
- Projeto novo, ref. `jzzwka…`: 50/50 migrações (51/51 em 01/10, com a tolerância de renovação).
- Barbara Sorroche criada lá, com nova senha provisória.
- O registro abaixo, do Oregon, ficou como histórico; aquele banco não vai ser usado.

### Rodado no piloto (MYASA-piloto), 30/09, com os dados dados pela dona do produto

- Organização "Arts and Sports Academy", operação "Operação Principal", primeira Administração
  **Barbara Sorroche** (nome de uso Barbara, usuário `barbara.sorroche`).
- A senha provisória foi entregue à dona do produto no chat e não fica registrada em lugar nenhum.
  A Barbara troca a senha no primeiro login.

## D3 · Lista do doc 12, item por item — feito

Teste novo `fase-d-seguranca`: **50 verificações**, uma por item do doc 12. Banco de teste com
duas unidades (Snowland e Acquamotion), duas áreas e Bailarinos com supervisão diferente por
local.

| Item do doc 12 | Como ficou provado |
|---|---|
| RLS em todas as tabelas, zero acesso anônimo | consulta ao catálogo no próprio teste: nenhuma tabela exposta. O mesmo vale para o piloto, porque o migrador recusa terminar com tabela exposta |
| Trava contra o banco do piloto nos testes | já existia (`test-database-identity`) |
| "Ver como" fora de produção | o seletor fica atrás de `import.meta.env.DEV`; no build de produção, "Revisar menu como" e `myasa-review-role` aparecem 0 vezes |
| Elenco pedindo dado de outra pessoa → 403 | ficha, edição, presença de outra pessoa, folga (lista mostra só a própria, sem o motivo dos outros), decisão de folga, check-in do local, grade do local, área pronta, Registro |
| Escopo da Supervisão | Deborah não marca nem ajusta Bailarinos. **Victor (Bailarinos em Snowland) não lê nem escreve em Acquamotion** (pronta, ajuste, grade, Programação). Victor não decide folga de Patinadores. Controle positivo: Stephani marca Bailarinos em Acquamotion |
| Direção é leitura | lê a escala; recebe 403 em pronta, ajuste, publicar, gerar, Programação, folga, editar e criar conta |
| Conta só pela Administração; trocar perfil exige motivo | Supervisão e Direção 403, sem sessão 401, perfil sem motivo dá 400 `REASON_REQUIRED` |
| Senha nunca em texto puro | hash bcrypt no banco; respostas de login e troca de senha sem senha e sem hash; **o log capturado durante o teste não contém** senha, senha errada, senha nova, token nem hash |
| Sessão expira | **decidido em 30/09: 30 dias sem abrir o app** (cada uso renova). Sessão vencida não renova (401) |
| Desligamento com sessão aberta | Louis desligado com motivo: a próxima chamada falha na hora (401), a sessão não renova, ele fica inativo (não é apagado) e sai da escala |

**Corrigido no caminho: segredo no log.**
- Antes, o log só escondia os cabeçalhos de autenticação. Um erro de banco ao salvar uma pessoa
  gravava a consulta com os parâmetros: hash de senha, motivo de falta, token.
- Agora o `serializarErro` (`lib/logger.ts`) corta os parâmetros (`params: [ocultos]`).
- Os campos `password`, `newPassword`, `currentPassword`, `passwordHash`, `refreshToken`,
  `accessToken`, `token` e `senhaProvisoria` são mascarados em até dois níveis de profundidade.

**Mutação** (quebrar a regra de propósito; o teste falhou em todas):
- tirar o serializador → hash no log
- token de desligado continuar valendo
- Supervisão marcar qualquer área → 2 falhas
- Elenco ver folga dos outros

**O que fica de fora da D3:**
- **Menores de idade**: depende da decisão A7 (C8).
- **Arquivos da Biblioteca**: ficam no Postgres, servidos só pela API autenticada, sem bucket
  público.
- **Ficha de pessoa.** O doc 12 diz "MEM não tem acesso à tela", mas a decisão posterior da tela 07
  deixou o Elenco ver os colegas da própria área. Ficou assim: o Elenco vê só a própria área, sem
  ficha administrativa, e telefone/e-mail só conforme a escolha de cada pessoa (Perfil).

## D4 · Suíte inteira verde — em andamento

**Feito:**

1. **O executor roda tudo e mostra o resumo** (`tests/run-tests.mjs`).
   - Antes, parava no primeiro arquivo que falhava. Como `asa-actions-http` falhava, os arquivos
     depois dele nunca rodavam na execução completa.
   - Agora roda os 37 arquivos e imprime "Resumo da suíte", com ok/FALHOU e o tempo de cada um.
     Sai com erro se algum falhar.
   - `MYASA_TEST_PARAR_NO_PRIMEIRO=1` mantém o comportamento antigo.
2. **A instabilidade do block7 tinha causa: a hora do dia.**
   - Rodando entre 22h e 06h de São Paulo, o silêncio noturno da casa (22h–06h, entregue hoje na
     C4) adiava o push do "folga negada". O teste, que espera o envio em 10 segundos, falhava.
   - Correção: a organização do teste do block7 nasce com o silêncio desligado. O block7 prova a
     janela de desfazer e a fila sem duplicar; o silêncio tem o teste próprio,
     `fase-c-perfil-regras`.
   - Provado às 22:34: 3 de 3 passaram. Tirando a correção, falha de novo à noite (2 falhas).
   - **A instabilidade registrada antes de hoje é outra coisa**, porque o silêncio não existia.
     Suspeita principal: o `api-server` de pré-visualização ligado ao mesmo banco de teste.
     O agendador dele processa a mesma fila e "rouba" a entrega que o teste espera ver.
     **Regra:** rodar a suíte com o `api-server` de pré-visualização desligado.
3. **Dependências quebradas, consertadas.**
   - O `pnpm-workspace.yaml` tinha o lembrete que o pnpm escreve sozinho:
     `allowBuilds: esbuild: set this to true or false`. Com esse texto, todo `pnpm install` (e
     todo `pnpm run`, que verifica as dependências antes) abortava com `ERR_PNPM_IGNORED_BUILDS`.
     O abort deixava os pacotes desligados: `node_modules` da API e do `lib/db` vazios, esbuild
     sumido.
   - Preenchido com `esbuild: true`. O esbuild já estava em `onlyBuiltDependencies`.
   - Rodado `pnpm install --frozen-lockfile`: 1173 pacotes reaproveitados do store local, nada
     baixado, nenhuma versão mudou.

**Primeira execução completa com o resumo: 35 de 37 passaram.**
- block7: a causa da hora, corrigida acima.
- `asa-actions-http`: do Codex. A verificação que cai é o texto da ASA para "alterar o prazo" de
  tarefa.

**Segunda execução completa, depois das correções e em pleno silêncio noturno: 36 de 37
passaram.** Só falhou `asa-actions-http`.

**Para fechar a D4:**
- O Codex resolve o `asa-actions-http`.
- A suíte completa passa três vezes seguidas.

## D6 · Carregando, erro e sem conexão — feito

**Como foi conferido:**
- No navegador, com sessão real no banco de teste.
- Um simulador intercepta só as chamadas das telas (o login fica de fora) em três cenários:
  servidor com erro (500), servidor lento (5 s) e sem rede (fetch falha).
- Rodado em todas as telas da Administração e do Elenco.

**O que estava errado e foi corrigido:**

| Tela | Problema | Agora |
|---|---|---|
| Check-in (Supervisão/Administração) | com erro, mostrava **"Nenhum local no seu acesso"**. O `useCycleDirectory` engolia o erro e devolvia lista vazia | "Não consegui carregar os locais. Confira a conexão." e "Tentar de novo" |
| Folgas, Painel, Mensagens | erro sem botão de tentar de novo | "Tentar de novo" (o `State` do ciclo ganhou `onRetry`) |
| Escalas | enquanto a lista de locais chegava, mostrava **"SEM ESCALA"**; com erro, também | "carregando…" e "Montando a escala…" enquanto carrega; "não carregou" no erro |
| Minha escala (Elenco) | com erro, dizia "ainda não publicada" | "não carregou" |
| Mensagens | enquanto carregava, mostrava "Comece uma conversa" | "Carregando conversas…" |
| Shows | enquanto carregava, mostrava "Ainda não há shows cadastrados" | "Carregando os shows…" |

**Aviso único de "sem conexão" (`components/aviso-sem-conexao.tsx`, no topo do shell):**
- Liga quando o navegador avisa que está offline **ou** quando um pedido falha por rede (celular
  "conectado", mas sem sinal). Desliga na primeira resposta que chegar.
- Texto: "Sem conexão. O que está na tela pode estar desatualizado, e o que você mandar agora não
  fica guardado. Para check-in ou falta, avise a sua supervisão por fora."
- O `customFetch` (`lib/api-client-react`) ganhou `setNetworkStatusHandler((online, startedAt) => …)`.
  O aviso dá razão ao pedido que começou por último, para um pedido velho que termina depois não
  desfazer o estado. Foi preciso regenerar as declarações (`tsc -b lib/api-client-react`).
- Conferido:
  - aparece em Meu Dia, Check-in, Escalas e Mural sem rede;
  - some quando a rede volta;
  - cabe nos 375 px do celular, sem rolagem lateral;
  - a sessão continua aberta.

**Resultado final nos três cenários:**
- **Erro:** todas as telas mostram a mensagem e "Tentar de novo" (Responsabilidades usa
  "Tentar novamente").
- **Lento:** todas mostram que estão carregando, sem texto enganoso.
- **Sem rede:** o aviso único aparece.
- O build de produção continua passando na verificação da D1.

**Achado à parte — corrigido em 01/10 (autorizado pela dona do produto).** A renovação de sessão é
feita a cada 15 min e troca o token a cada uso. Se o app fosse fechado ou recarregado no instante
exato de uma renovação, o servidor já tinha trocado o token, mas o aparelho não chegava a guardar o
novo. Na volta, a pessoa caía no login. Aconteceu no teste quando recarreguei a página no meio de uma
renovação.

**Correção: janela de tolerância de 30 s** (`TOLERANCIA_RENOVACAO_MS` em `auth.service.ts`).
- Migração `0050_refresh_token_tolerancia` (com rollback): colunas `rotated_at` e `replaced_by` em
  `refresh_tokens`.
- Um token trocado por renovação há até 30 s ainda renova. A janela conta da primeira troca; usar a
  tolerância não a estica.
- A troca roda numa transação com a linha travada: duas renovações simultâneas com o mesmo token
  (duas abas) não derrubam a sessão.
- O token que se perdeu passa a valer só mais 30 min, em vez de 30 dias.
- Nada disso vale para sessão encerrada. Sair, encerrar as outras sessões, senha redefinida e
  desligamento continuam derrubando na hora. A tolerância segue a cadeia de trocas até o token mais
  novo; se ele foi revogado sem troca, recusa.
- Sair com o token antigo (o app não guardou o novo) encerra também o novo.
- O registro de segurança marca a renovação feita pela tolerância (`TOKEN_REFRESHED`, `tolerancia: true`).

**Teste:** `fase-d-renovacao-tolerancia` (26 verificações, banco de teste).
- Mutações, todas pegas pelo teste:
  - sem seguir a cadeia;
  - janela ignorada;
  - tolerância que estica a janela;
  - Sair sem seguir a cadeia;
  - token perdido sem encurtar;
  - sem tolerância nenhuma.
- Regressão: perfil-senha, seguranca, primeira-administracao, block7, permission-matrix e
  profile-authorization passaram.
- Aplicada no banco de São Paulo: 51/51 migrações; a Barbara continua lá.

**Banco de teste trocado (01/10).** O projeto `myasa-test` foi apagado pela dona do produto. O
MYASA-piloto (Oregon), que ficou sem uso, virou o banco de teste: `.env.test` e a trava
`MYASA_TEST_DATABASE_REF` apontam para ele.

## D5 · App leve no 4G — feito no front; o tempo total depende da hospedagem (A1)

**Medição real.** Medi pelo source map, atribuindo cada trecho do JS final à fonte. A soma do
arquivo inteiro de cada fonte engana: o `api.ts` gerado tem 444 kB, mas quase nada dele sobra no
pacote.

| | Antes | Depois |
|---|---|---|
| JS inicial (todo mundo baixa) | 524 kB (162 kB gzip) | **341 kB (110 kB gzip)** |
| CSS inicial | 191 kB (32 kB gzip) | **144 kB (25 kB gzip)** |
| Código baixado para abrir o Meu Dia (Elenco, build de produção) | — | **151 kB gzip** no total |

**O que mudou:**
- **Login** (`zod` + `react-hook-form`, ~85 kB) e **troca obrigatória de senha** viraram `lazy()`
  no `App.tsx`: só baixam quando aparecem.
- **Perfil** (21 kB) virou `lazy()` no shell. O `useSignOut` foi para `hooks/use-sign-out.ts`, e o
  Perfil reexporta.
- **ASA** (`global-asa-assistant`, 30 kB) virou `lazy()` no shell, dentro de
  `<Suspense fallback={null}>`. Carrega no próprio pacote, depois da tela. **Não mexi no arquivo
  da ASA**, só na forma de importar.
- `TooltipProvider` saiu do `App.tsx`: só o layout antigo (`ui/sidebar`) usava tooltip, e ele não
  abre mais.
- Tailwind: `@source not` para `pages/admin`, `pages/supervisor`, `pages/membro` e
  `components/admin-layout.tsx`. São 52 arquivos que o app não abre mais e geravam ~40 kB de CSS.
- `mapa-palco.js` ganhou `defer`. Roda na mesma ordem, antes do app, mas não bloqueia a primeira
  pintura.
- `.claude/launch.json`: nova configuração `web-admin-producao` (`vite preview` na porta 4173),
  para conferir o build de produção no navegador.

**Conferido no build de produção:**
- Sem sessão, vai para o login, que baixa o próprio pacote.
- Julia (Elenco) abre o Meu Dia. A ASA aparece depois, no pacote dela.
- A verificação da D1 continua passando.

**Os 3 segundos no 4G.**
- Com o código de agora, num 4G lento (1,6 Mbps, 150 ms de ida e volta):
  - ~0,6 s de conexão e HTML;
  - ~0,85 s de código;
  - mais as chamadas `/auth/me` e `/meu-dia`.
- **O que decide é onde a API fica em relação ao banco.** Neste computador, com o banco de teste
  nos EUA, o `/api/meu-dia` levou **2,9 s**: são várias consultas em sequência, e cada uma cruza o
  continente. Com a API na mesma região do banco, cada consulta cai para milissegundos, e a
  estimativa total fica em ~2–2,5 s no 4G lento (~1 s no 4G comum).
- **Isto entra na decisão A1:**
  - O banco do piloto (MYASA-piloto) está em **us-west-2 (Oregon)**. O elenco está no Brasil.
  - Opção 1: a API em us-west-2, ao lado do banco.
  - Opção 2: banco e API em São Paulo. Existe um projeto "MyASA Piloto" pausado em sa-east-1.

## Próximos

- **D4**: suíte inteira verde, com resumo de todos os arquivos.
- **D5**: leveza no 4G. O Codex já começou a dividir o shell com `lazy()`.
- **D6**: estados de carregando, erro e sem conexão.
