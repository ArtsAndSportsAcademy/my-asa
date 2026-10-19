# Handoff — testes, revisão de telas e diagnóstico (18/10/2026, sessões 1 e 2)

Quem lê só este arquivo deve conseguir continuar. Leia antes `AGENTS.md` e o handoff anterior
(`handoff-2026-10-16-sessao-4.md`). Branch: `codex/myasa-novo`. Nunca fazer merge na `main`.

**Sessão 1:** só build, tipos, testes e revisão de telas — nenhum código alterado.
**Sessão 2:** corrigido `artifacts/web-admin/src/pages/livro-do-dia.tsx` (ver seção 4b).

---

## 1. Testes e builds

### Builds e tipos (todos limpos)

| O quê | Resultado |
|---|---|
| `tsc -p tsconfig.json --noEmit` em `api-server` | ✅ sem erros |
| `tsc -p tsconfig.json --noEmit` em `web-admin` | ✅ sem erros |
| `node ./build.mjs` em `api-server` | ✅ ok (5,2 MB) |
| Vite build em `web-admin` | ✅ ok (1904 módulos em 7,25 s) |
| `verificar-nomes-build.mjs` (regra D1) | ✅ nenhum dos 51 nomes no build |

### Bateria de testes (banco de teste)

**Status:** a bateria foi iniciada em background no começo da sessão e estava ainda em andamento quando o handoff foi escrito. Os resultados abaixo cobrem o que ficou no arquivo de saída até então.

| Arquivo | Resultado |
|---|---|
| `profile-authorization.test.mjs` | ✅ 16 verificações passaram |
| `operation-lifecycle.test.mjs` | ✅ 52 verificações passaram |
| `daily-book-fill.test.mjs` | ✅ 87 asserts passaram |
| `block1-integrity.test.mjs` | ✅ 16 asserts passed |
| `block2-integrity.test.mjs` | ✅ 11 asserts passed |
| `block3-integrity.test.mjs` | ✅ 14 asserts passed |
| `block4-integrity.test.mjs` | ✅ 13 asserts passed |
| `permission-matrix.test.mjs` | ❌ 463/463 rotas protegidas ok (401); **1 falha nos casos de autorização real** |
| `block5-integrity.test.mjs` | ✅ 23 asserts passed |
| `block6-integrity.test.mjs` | ⚠️ EMAXCONNSESSION (infraestrutura) + foreign key cleanup — não é falha de código |
| `block7-integrity.test.mjs` | ✅ 77 asserts passed |
| `show-book-slots-groups.test.mjs` | ✅ 10 asserts passaram |
| `daily-book-session-blocks.test.mjs` | ❌ 4 falhas — EMAXCONNSESSION + "Falha de Registro solicitada pelo teste" |
| `logical-removal.test.mjs` | ⚠️ EMAXCONNSESSION (infraestrutura) — bateria ainda corria |
| Demais arquivos | não chegaram ao arquivo de saída antes do handoff |

**Sobre as falhas:**

- **`permission-matrix`: 1 falha nos casos de autorização real.** Os 463 checks de 401 sem autenticação passaram todos. A falha é num teste autenticado (a saída não imprime qual rota). Precisa investigar o test file `permission-matrix.test.mjs` para saber qual caso falhou e se é código ou teste desatualizado.

- **`daily-book-session-blocks`: 4 falhas.** Duas categorias:
  - `EMAXCONNSESSION` no Supabase session mode (pool de 15 conexões esgotado) — problema de infraestrutura do banco de teste, não de código.
  - `Falha de Registro solicitada pelo teste` → a API recusou por 500 em `POST /api/daily-book/generate` e `POST /api/deliveries` porque o teste injeta falha proposital no histórico para testar rollback. Se o teste estava passando antes e parou, algo no código pode ter quebrado a transação de rollback.

- **EMAXCONNSESSION em vários arquivos** — o banco de teste do Supabase tem pool limitado a 15 conexões em session mode. Quando a bateria roda longa, o pool esgota. Não é falha de código. Encerrar e reabrir o servidor de teste entre arquivos longos pode ajudar.

**9 arquivos fora da bateria padrão** (listados em `artifacts/api-server/tests/run-tests.mjs` como extras ou ausentes; precisam ser rodados separadamente):
`asa-library-gaps`, `asa-library-citations`, `sondagem-mes-rodizio`, `regras-de-escala`,
`restricoes-horario-http`, `escala-regras-http`, `teatro-natal-outubro`,
`daily-book-troca-por-area`, `show-book-formato-do-palco`.

---

## 2. Revisão de telas (empresa de teste)

Revisão feita apenas com perfil **Administração** a **375px** nesta sessão. Perfis Direção, Supervisão e Elenco e a largura de 1280px ficaram para a próxima sessão.

### Achados por tela

| Tela | Rota | Resultado | Achados |
|---|---|---|---|
| Meu Dia | `/meu-dia` | ✅ | Funciona; card de instalação aparece (esperado em desktop) |
| Escala | `/escalas` | ⚠️ | **Q11:** abre no "Ginásio 27948" (local de sessão de teste anterior, não da empresa de teste); **flash de dados antigos** ao trocar de local (~2–3 s com dados do local anterior visíveis enquanto o novo carrega |
| Livro do Dia | `/livro-do-dia` | ⚠️ | **Q13:** texto "carregando…" no header permanece após dados carregarem; **Q12:** texto "confira o Livro do Show de origem em 13 Shows" — número estranho; shows ficam abaixo da dobra |
| Painel | `/painel` | ✅ | 4 números distintos; data correta; itens acionáveis |
| Operações | `/operacoes` | ✅ | Botão "Nova operação"; filtros; ações Editar/Locais/Pessoas/Pausar/Encerrar visíveis a 375px |
| Locais | `/locais` | ✅ | Botão "Novo local"; tabs Semana/Registros; busca; "nenhuma área com supervisão" explicado |
| Pessoas e acessos | `/pessoas` | ✅ | "Selecionar várias" + "Nova pessoa"; busca; filtro por área; Grade/Lista; status Todas/Ativas/Afastadas/Sem grupo |
| Tarefas | `/responsabilidades` | ✅ | Tabs Tarefas/Responsabilidades; filtros Hoje/Em aberto/Vencidas/Feitas/Minhas; "Preparar lote" + "Nova tarefa" |

### Problema de dados da empresa de teste

A empresa de teste acumulou locais extras de sessões anteriores: **"Ginásio 27948"** e **"Ginásio 79154"** associados à operação Acquamotion (teste), e **"Pessoa 79154"** / **"Figurino 79154"** na lista de pessoas (desligados). Esses itens apareciam nas telas de Escala, Locais e Operações. Não é defeito de código — é dado residual.

Se quiser limpar: encerrar logicamente os locais "Ginásio 27948" e "Ginásio 79154" (no banco de teste) e verificar se "Pessoa 79154" pode ser desligada ou ignorada.

### Crivo das 16 perguntas — pendências identificadas

| Pergunta | Achado |
|---|---|
| Q11 (em que dia/local a tela abre?) | Escala abre no primeiro local alfabético ("Ginásio 27948" em vez de "Teatro (teste)") |
| Q12 (diferencia linha de linha?) | Livro do Dia: texto "em 13 Shows" é confuso |
| Q13 (texto acompanha o contexto?) | Livro do Dia: "carregando…" não sai depois que os dados chegam |
| Q14 (o que a pessoa vê enquanto espera?) | Escala: flash de dados antigos durante troca de local |

Nenhum desses foi corrigido nesta sessão — precisam de revisão de código ou decisão da Babi.

---

## 3. Nenhuma migração nova

Não foi criada nenhuma migração nesta sessão. A ordem de promoção segue igual à do handoff anterior:

1. **Migração 0070** em produção (as 0067–0069 já foram; rollback em `lib/db/drizzle/rollback/0070_*.down.sql`).
2. **API** (`my-asa`).
3. **Site** (`my-asa-web`) — antes de subir, rode `verificar-nomes-build.mjs` (regra D1).

---

## 4. Código corrigido em 18/10 (sessão 2)

### 4a. permission-matrix
A falha de autorização vista na sessão 1 desapareceu no rerun (0 falhas). Era transitória — provavelmente
EMAXCONNSESSION forçando a conexão a cair antes do teste de auth completar. Sem mudança de código.

### 4b. Livro do Dia (`artifacts/web-admin/src/pages/livro-do-dia.tsx`)

**"carregando…" que não sumia:** o header ficava preso em "carregando os shows do dia…" enquanto o código
aguardava os detalhes de cada livro completarem em paralelo. No banco de teste isso demorava vários segundos.
Corrigido: `setBooks` e `setLoading(false)` são chamados logo após a lista chegar; os detalhes carregam em
fundo e atualizam os cartões depois.

**"em 13 Shows" hardcoded:** o aviso de livro sem cenas dizia "confira o Livro do Show de origem em 13 Shows"
— número sem sentido. Corrigido para "confira o Livro do Show de origem."

Commit: `1080df2`.

## 5. O que a Babi precisa conferir ou decidir

1. **No iPhone:** Perfil (nome, senha) e PDF da Biblioteca — ficou pendente do handoff anterior.
2. **Escala:** flash de dados antigos ao trocar de local — aceitar ou corrigir?

---

## 6. O que ficou para a próxima sessão

- **Revisão das telas com Direção, Supervisão e Elenco** (a 375px e 1280px).
- **Rodar a bateria completa de testes de novo** depois que terminar — conferir `permission-matrix` e `daily-book-session-blocks` com saída detalhada.
- **Rodar os 9 arquivos fora da bateria padrão** (listados acima).
- **Limpeza de dados da empresa de teste** (ginásios extras) se desejado.
- **Dar "pode enviar"** para push do código à `codex/myasa-novo` e promoção (API → site), depois de conferir os items acima.
