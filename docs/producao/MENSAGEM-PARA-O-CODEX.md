Codex, há uma nova rodada do Claude pronta para subir na mesma branch `codex/myasa-novo`. É a **etapa 1 do plano para aproximar o app do desenho** (acabamentos). O plano e as decisões da dona do produto estão em `docs/COMPARACAO-DESENHO-APP-2026-10-02.md`, seção "Etapa 1".

**Continuação do Codex (02/10):** resultados atuais, correções e limites da conferência estão em [VALIDACAO-ETAPA-1-CODEX-2026-10-02.md](VALIDACAO-ETAPA-1-CODEX-2026-10-02.md). Os números abaixo preservam o resultado original do handoff, não substituem a nova validação.

1. **O que entra**
   - **Menu e cabeçalho** (`components/shell-foundation.tsx` e `shell-foundation.css`, no fim do arquivo). Arquivo compartilhado; o que mudou:
     - grupos e nomes do menu iguais ao desenho;
     - nomes do Elenco;
     - "Folgas e solicitações" num item só, com duas abas (campo `alsoHref` no item de menu);
     - data embaixo do título;
     - sino com não lidas e lista (`NotificationBell`, usa `/api/notifications`);
     - nomes curtos na barra de baixo (`tabLabel`);
     - o Elenco vê Shows no menu (`onlyPublished`).
     - **Não mexi na ASA.**
   - **Shows:**
     - cartão com responsável, descrição e data;
     - correção do favorito, que nunca adicionava;
     - Elenco só com shows publicados.
     - Arquivos: `pages/shows.tsx` e `.css`, `routes/show-book.ts` (GET `/show-books`: para MEMBER, rascunho só se for o show delegado ao capitão).
   - **Responsabilidades:** filtros com os nomes do desenho e "Minhas" (`pages/responsibilities-tasks.tsx`).
   - **Mural:**
     - "cancelar aviso" com motivo;
     - destino do aviso com área ou local;
     - erro dentro da janela.
     - Arquivos: `pages/communication.tsx` e `.css`, `routes/communication-hub.ts`. O GET devolve `canCancel` e não expõe `authorId`.
     - **Regra nova (decisão da dona do produto, 02/10):** a Supervisão publica aviso igual à Administração (toda a casa, qualquer área ou qualquer local). Rota nova `GET /communication/destinations` (só nomes; Administração, Direção e Supervisão). O POST recusa área ou local de outra organização.
     - **Se a ASA publica ou rascunha aviso** em `asa-*`, aplique a mesma regra lá. Eu não mexi nesses arquivos.
   - **Aviso para pessoas escolhidas (novo):**
     - destino `PEOPLE` com `recipientIds` (até 300, todos da organização e ativos);
     - só as pessoas escolhidas e quem publicou leem e dão ciente;
     - o GET devolve `recipientNames`;
     - a lista entra no Registro.
     - Arquivos: `routes/communication-hub.ts`, `services/announcement-access.ts` (`canReadAnnouncement` aceita `id` e `authorId` opcionais; quem publicou sempre lê), `services/announcement-version.ts` (tipo), `services/meu-dia.ts` (passa `authorId`), `lib/db/src/schema/communication.ts`, `pages/communication.tsx` e `.css`.
     - **Atenção, ASA:** em `routes/asa.ts`, as listagens do Mural chamam `canReadAnnouncement`. Se o `select` não traz `id` e `authorId`, um aviso `PEOPLE` fica negado para quem não é Administração ou Direção. É uma falha fechada, mas a pessoa escolhida não verá o aviso pela ASA. Inclua `id` e `authorId` nesses `select`.
   - **Migração nova `0053_mural_pessoas`** (com o rollback em `drizzle/rollback/`).
     - Está aplicada só no banco de teste.
     - **Não aplique em produção:** quem aplica é o Claude, depois de a dona do produto autorizar, **antes** de promover a API.
     - Sem ela, o Mural em produção quebra com o código novo.
   - **Entrada:**
     - login novo com "mostrar senha", "Esqueci minha senha" e "Conta desativada" (`pages/login.tsx`, `pages/login.css`);
     - primeiro acesso só com senha nova e repetir (`pages/force-password-change.tsx`, `lib/senha-da-entrada.ts`, novo);
     - rota pública nova `POST /api/auth/esqueci-senha` (`routes/auth.ts`). Ela sempre responde igual, avisa a Administração no máximo uma vez a cada 30 min por pessoa e grava no Registro.
   - **Regra da senha:** 8 caracteres, com letra e número (`routes/users.ts` em `/users/me/password`, `pages/perfil.tsx`).
   - **Testes:**
     - `tests/block6-http-matrix.ts`: estante do Elenco sem rascunho;
     - `tests/grupo-c-communication.test.ts`: `canCancel`, área implícita da Supervisão, `authorId` fora;
     - `tests/fase-c-perfil-senha.test.ts`: regra da senha e esqueci a senha;
     - `tests/permission-matrix.test.ts`: `/auth/esqueci-senha` marcada como pública.
   - **Docs:** `docs/COMPARACAO-DESENHO-APP-2026-10-02.md` e este recado.
   - **Uma migração nova: 0053** (ver acima). A produção precisa dela antes da API nova.

2. **Testes rodados no banco de teste** (por arquivo):
   - `block6-integrity`: 238;
   - `grupo-c-communication`: 117;
   - `fase-c-perfil-senha`: 41.
   - **Suíte completa: 41 de 42.** Só falha `asa-actions-http` (linha 624, 403 em vez de 200), que é a pendência antiga sua.

3. **Pendente seu:** a expectativa do `asa-actions-http` (linha ~624: conversa criada depois do papel revogado deve ser recusada).

4. **Antes do commit**, como sempre:
   - `git status` sem `.env.*`, `.tmp*`, `*.log`, `.audit-tmp/`, `tests/.dist/`;
   - kit do mascote (`artifacts/brand/`) e `output/` fora;
   - typechecks da API e da web.

5. **Commit e push** em `codex/myasa-novo`. **Não junte na `main`.** Não aplique migração em produção.

Quando terminar, me diga o hash do commit. A dona do produto promove o deploy novo na Vercel (site **e** API, projeto `my-asa`) e eu confiro em produção.
