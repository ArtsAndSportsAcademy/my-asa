Codex, preciso que você envie a branch `codex/myasa-novo` para o GitHub, para a Vercel montar a
versão de teste. Contexto e cuidados:

1. **O que mudou desde o último commit (fe69f3b)**
   - O seu trabalho: ASA, kit do mascote, Biblioteca (`0052_library_page_citations`) e o resto.
   - O trabalho do Claude: Fases B, C e D, preparação de produção, tolerância de 30 s na renovação
     da sessão (`0050`) e a tela nova **Solicitações** (`0051`).
   - Relatórios do Claude:
     - `docs/FASE-B-ENTREGA-2026-09-30.md`
     - `docs/FASE-C-ENTREGA-2026-09-30.md`
     - `docs/FASE-D-ENTREGA-2026-09-30.md`
     - `docs/SOLICITACOES-ENTREGA-2026-10-01.md`
     - a pasta `docs/producao/`

2. **Antes do commit**
   - Termine o kit do mascote da ASA em tamanho menor. Hoje `artifacts/brand/asa-mascot-kit` tem
     ~103 MB; não suba arquivos grandes assim.
   - `artifacts/api-server/scripts/qa-e2e-accounts.ts` tem uma senha fixa no código
     (`const password = "..."`). Troque por variável de ambiente antes de subir.
   - Confira com `git status` que nada destes vai junto (o `.gitignore` já cobre todos):
     - `.env.*` (`.env.producao`, `.env.piloto`, `.env.test`)
     - `.tmp*`
     - `*.log`
     - `.audit-tmp/`
   - A pasta `output/` (PDFs gerados) e a remoção de `lib/integrations-anthropic-ai` são suas:
     decida se vão.
   - Rode `node node_modules/typescript/bin/tsc -b lib/db` antes do typecheck da API. Sem isso, o
     `libraryDocumentPageCitationsTable` da sua `0052` aparece como inexistente.

3. **Commit e push**
   - Pode ser mais de um commit: o seu trabalho, e "fases B–D + produção + Solicitações" para o do
     Claude.
   - Depois: `git push -u origin codex/myasa-novo`.
   - **Não junte na `main` ainda.** Primeiro testamos na versão de teste (preview) da Vercel.

4. **Produção (decidida em 01/10)**
   - **Infraestrutura:**
     - Supabase em São Paulo + Vercel (`docs/producao/GUIA-SUPABASE-VERCEL.md`).
     - O `artifacts/api-server/vercel.json` usa a região `gru1` (São Paulo).
     - As variáveis de ambiente do projeto `my-asa` na Vercel já estão preenchidas (Production e
       Preview).
     - Rotas novas `POST /api/internal/ciclo` e `POST /api/internal/tarefas-do-dia`, chamadas pelo
       agendador do Supabase.
   - **Banco de São Paulo:**
     - Tem as migrações de 0000 a 0051 e a primeira Administração.
     - A sua `0052_library_page_citations` **não** foi aplicada lá. Ela vai quando a dona do
       produto autorizar.
     - **Não aplique migração no banco de produção.**
   - **Banco de teste:** agora é o MYASA-piloto (Oregon); o `myasa-test` foi apagado. Para rodar a
     suíte, use o `.env.test` atual.

5. **Solicitações (Claude, 01/10): para você não estranhar**
   - **Arquivos novos:**
     - `routes/solicitacoes.ts`
     - `services/solicitacoes.ts`
     - `pages/solicitacoes.tsx` e `.css`
     - o teste `fase-e-solicitacoes`
   - **Arquivos alterados:**
     - `shell-foundation.tsx`: item "Solicitações" no menu, depois de Folgas.
     - `escala-dia.ts`: horário aprovado vira bloco com `origem: "solicitacao"`.
     - `meu-dia.ts`: pedidos pendentes aparecem no Meu Dia.
     - `app-routes.ts`: aviso `request.*` abre `/solicitacoes`.
     - Botão "Pedir troca ou horário" na Minha escala.
   - **A rota antiga `/api/requests`, que a ASA usa, não mudou.** A tabela `requests` só ganhou
     colunas e valores novos (`ESCALA_SLOT`, `WAITING_PEER`, `CANCELLED`).
   - Se a ASA for criar ou ler pedidos do Elenco, o caminho novo é `/api/solicitacoes`. As regras
     de quem decide estão lá.

6. **Pendente seu na D4:** o teste `asa-actions-http` ainda falha (texto da ASA para "alterar o
   prazo" de tarefa). A suíte roda até o fim e mostra o resumo de todos os arquivos.

Quando o push terminar, me diga o nome da branch no GitHub e se a Vercel começou a montar o preview.
