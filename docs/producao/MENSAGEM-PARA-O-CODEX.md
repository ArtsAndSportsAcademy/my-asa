Codex, há uma nova rodada do Claude pronta (correções da auditoria de 01/10) para subir na mesma
branch `codex/myasa-novo`. A suíte completa foi rodada no banco de teste antes deste recado.

1. **O que entra (detalhes em `docs/AUDITORIA-2026-10-01.md`, seção "Atualização")**
   - **Cadastro:**
     - "Nova pessoa" com perfil e área;
     - login e senha provisória gerados e mostrados uma vez;
     - troca de perfil com motivo (`PUT /api/users/:id/perfil`);
     - supervisão por área e local na tela Áreas;
     - local novo já ligado à operação.
     - Arquivos: `routes/users.ts`, `routes/areas-locations.ts`, `pages/cadastros.tsx` e `.css`.
   - **Check-in do Elenco** simplificado: `pages/operational-cycle.tsx` e `.css`.
   - **Textos:**
     - Mensagens sem "online agora" e Biblioteca com tipos em português (`pages/communication.tsx`
       e `.css`);
     - mensagem de erro da Agenda (`pages/agenda-workspace.tsx`);
     - aviso de "esqueci a senha" (`pages/login.tsx`);
     - textos neutros e Meus shows do Elenco (`pages/livro-do-dia.tsx`);
     - Meu Dia vazio (`pages/meu-dia.tsx`, `services/meu-dia.ts`).
   - **Acabamento:**
     - título sem repetir no celular (`shell-foundation.css`, 2 regras no fim);
     - estrela de favorito com nome (`pages/shows.tsx`).
   - **Testes:**
     - `tests/fase-e-cadastro.test.ts` (novo);
     - `tests/run-tests.mjs`;
     - `tests/permission-matrix.test.ts`: limpeza do local criado, que agora nasce ligado à
       operação.
   - **Docs:** `docs/AUDITORIA-2026-10-01.md`, `docs/SOLICITACOES-ENTREGA-2026-10-01.md` e
     `docs/producao/`.
   - **Sem migração nova.** O banco de produção não precisa de nada.

2. **Pendente seu: `asa-actions-http`.** Continua falhando uma verificação: "Members cannot query
   team responsibility assignments".
   - O Elenco recebe a frase da **linha ~1015** de `asa-command-engine.ts` ("…somente **para**
     Administração, Direção e Supervisão…"), e não a da linha ~1144 que você alterou.
   - Sugestão: desfaça a mudança da linha 1144, voltando a "somente **para** …", e, no teste
     (linha ~248), procure só "Administração, Direção e Supervisão".
   - A limpeza do teste já funciona, e o 403 de sessão não apareceu aqui.

3. **Antes do commit**, como sempre:
   - `git status` sem `.env.*`, `.tmp*`, `*.log`, `.audit-tmp/`;
   - kit do mascote (`artifacts/brand/`) e `output/` fora;
   - typechecks da API e da web.

4. **Commit e push** em `codex/myasa-novo`. **Não junte na `main`.** Não aplique migração em produção.

Quando terminar, me diga o hash do commit. A dona do produto promove o deploy novo na Vercel e eu
confiro em produção.
