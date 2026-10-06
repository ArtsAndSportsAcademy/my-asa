Codex, o Claude revisou as etapas 2 a 7 (06/10), achou problemas e completou o que faltava do desenho. Tudo está no disco, **sem commit**, na branch `codex/myasa-novo`. Detalhes em `docs/COMPARACAO-DESENHO-APP-2026-10-02.md`, seção "Revisão das etapas 2 a 7 pelo Claude (06/10)".

1. **Grave — migrações fora da lista.**
   - `0055_messages_stage6` e `0056_locais_funcionamento` **não estavam em `lib/db/drizzle/meta/_journal.json`**. Por isso nunca foram aplicadas, nem no banco de teste. Toda criação de local quebrava ("coluna operating_days não existe"), e 15 dos 44 arquivos de teste caíam por isso.
   - Corrigido:
     - 0055 e 0056 entraram na lista;
     - a 0055 ganhou `ENABLE ROW LEVEL SECURITY` + `REVOKE` na tabela nova `message_thread_preferences`;
     - as duas ganharam `--> statement-breakpoint` e rollback (`drizzle/rollback/0055…`, `0056…`).
   - **Sempre que criar uma migração, coloque-a no `_journal.json` e rode o `migrate.ts` no banco de teste antes de dizer que está pronto.**
   - **Produção (São Paulo) está na 0054** (consulta só de leitura em 06/10). Faltam 0055, 0056 e 0057.

2. **Defeitos corrigidos em `routes/messages.ts`:**
   - a rota `PATCH /messages/threads/:threadId/preferences` estava colada **dentro** do handler do POST de mensagem; foi movida para fora;
   - quem silenciou a conversa deixou de receber aviso de mensagem nova.

3. **O que entrou do desenho:**
   - **Mural (22)** — `routes/communication-hub.ts`, `services/announcement-audience.ts` (novo), `pages/communication.tsx` e `.css`, `pages/aniversarios-faixa.tsx`:
     - "X de Y deram ciente" (`ackSummary` no feed, só para quem gerencia) e `GET /communication/mural/:id/cientes` (quem falta);
     - data do evento (`eventDate`, migração nova **0057_mural_data_evento**);
     - aniversário como cartão BIRTHDAY no feed, com "Dar parabéns" (reação) e `reactionCount`; criado no dia, uma vez por pessoa, com Registro.
   - **Escalas (15)** — `pages/escalas.tsx`:
     - aba "Minha escala" para Administração, Direção e Supervisão;
     - atalhos "Folga" e "Registrar troca" no rodapé.
   - **Mensagens (23)** — `services/area-groups.ts` (novo), chamado no `GET /messages/threads`:
     - grupo automático por área (`context_type = AREA_GROUP`), com a área e quem a supervisiona;
     - entra quem chegou e sai quem mudou de área, com Registro;
     - aparece em "Meus grupos".
   - **Biblioteca (24):** "Pedir um material", que vira Solicitação "Outro assunto".
   - **Testes:** `tests/grupo-c-communication.test.ts` ganhou verificações de tudo isso (143 passam).

4. **Testes (banco de teste, 06/10):**
   - suíte completa: 43 de 44;
   - a única falha (`permission-matrix`, por causa da rota de preferências) passou depois da correção (23);
   - `asa-actions-http` passou.

5. **Folgas (feito pelo Claude):**
   - "Publicar mês": `POST /folgas/grid/publicar`, e `publicacao` no `GET /folgas/grid`. Avisa a operação, entra no Registro e mostra "mudou depois de publicar";
   - para quem gerencia, o calendário repetido saiu de baixo do mapa;
   - arquivos: `routes/folgas.ts`, `components/folgas-grid.tsx`, `pages/operational-cycle.tsx` e `.css`;
   - teste: `tests/block5-integrity.test.ts` (20).
   - **O commit desta rodada foi feito pelo Claude**, a pedido da dona do produto.

6. **Antes do commit:**
   - `git status` limpo de `.env.*`, `.tmp*`, `*.log`, `.audit-tmp/`, `tests/.dist/`, `artifacts/brand/`, `output/`, `.pnpm-store/`, `my-asa-main.zip`, `Nuevo Documento de texto.txt`;
   - typechecks verdes. O único erro da web é o `components/ui/spinner.tsx` (tipos duplicados do React), que só aparece com `node-linker=isolated`; o Claude reinstalou assim para conseguir testar.

7. **Commit e push** em `codex/myasa-novo`. **Não junte na `main`.**

8. **Produção:**
   - **não aplique 0055, 0056 e 0057 sem a dona do produto autorizar**;
   - com a autorização, aplique as três (em ordem) **antes** de ela promover o site e a API na Vercel;
   - se o código das etapas 6 e 7 já estiver publicado, Mensagens e Locais estão quebrados em produção até essas migrações entrarem.

Quando terminar, me diga o hash do commit.
