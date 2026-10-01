# Bloco 7 — implementação e aceite

Data: 17/09/2026. Banco utilizado: Postgres real configurado em `.env.test`. Nenhuma migração, publicação ou alteração foi feita em produção. Sem commit ou push nesta entrega.

## Estado do aceite

Implementação das quatro frentes concluída. A rodada final da suíte completa terminou com **488 asserts passando, exit 0: os 416 anteriores e 72 novos**. Nenhum teste foi removido ou pulado. A saída definitiva está em `.tmp/block7-full-delivery-20260917.log`.

**Não considerar o aceite completo enquanto não houver recebimento de Web Push em um navegador real instalado e conferência da paginação impressa.** O transporte controlado dos testes não prova entrega ao navegador.

## 1. Desfazer e confirmar

`services/undo.ts` centraliza as quatro ações: desativar formação, arquivar documento, remover pessoa do grupo e negar pedido de folga. A ação e sua janela ficam no Postgres; não dependem de um timer em memória. A negativa de folga agenda o envio para o mesmo instante de expiração, dez segundos depois do relógio do banco.

Desfazer bloqueia a linha, verifica ator/organização, expiração e alterações posteriores, restaura os campos, cancela o envio e escreve Registro **na mesma transação**. Não sobrescreve uma edição posterior. A decisão de folga original permanece, marcada por `reverted_at`, e continua no histórico. Uma falha do Registro reverte também a reversão e o cancelamento.

`POST /api/actions/:id/undo` é o caminho único. As respostas entregam `undo`; a remoção de membro preserva o HTTP 204 existente e entrega `X-MyASA-Undo`, exposto no CORS. O assistente ASA transmite imediatamente o mesmo evento, antes de esperar a resposta textual final.

A faixa global mostra Desfazer. Cancelar aviso publicado, desligar pessoa, alterar perfil e reabrir local usam motivo como confirmação, sem uma pergunta de confirmação anterior. Os formulários de perfil coletam o motivo na própria tela; as outras ações usam o diálogo central de motivo. Espaços em branco não atendem ao requisito. Nenhuma dessas quatro ações oferece desfazer.

**Limite operacional:** o envio fica elegível aos +10s, nunca antes. O processamento é periódico, portanto banco, rede e indisponibilidade da API podem atrasá-lo; não se promete entrega ao celular exatamente no décimo segundo. Reinícios preservam a fila. Entrega interna é idempotente; push externo pode repetir após uma queda entre envio e marcação de entrega — os provedores não participam da transação do Postgres.

## 2. PWA e Web Push

Manifest, ícones PNG derivados da Asinha existente, service worker e página offline estão em `artifacts/web-admin/public`. O worker não armazena respostas autenticadas, ficha de pessoa nem dados operacionais. Offline orienta usar a escala impressa, sem fingir que uma cópia antiga é atual.

Rotas novas:

- `GET /api/web-push/config`: só chave pública e situação de configuração.
- `POST /api/web-push/subscriptions`: inscrição do navegador, depois de abertura instalada registrada.
- `DELETE /api/web-push/subscriptions/:id`: desativação da própria inscrição, com Registro atômico.
- `POST /api/pwa/installations`: primeira abertura instalada e última abertura.
- `GET /api/pwa/installations`: relatório exclusivo da Administração, exibido em Pessoas.

Permissão só é solicitada por clique explícito **depois** de instalar e abrir pelo ícone. iPhone em navegador incorporado, WhatsApp ou outro navegador recebe a orientação de abrir no Safari. A inscrição é distinta de Expo; os tokens e a rota móvel legados continuam existindo.

As três categorias são: escala mudou (publicação, republicação ou alteração de alocações publicadas), check-in do turno e aviso que pede ciente. O payload contém texto genérico: nunca motivo de ausência, ocorrência ou dado de saúde. Não foram acrescentados pushes de chat, folga ou ocorrência; a negativa de folga conserva a notificação interna e o caminho móvel legado, atrasados pela janela central.

Endpoints de inscrição aceitam somente provedores Web Push conhecidos, HTTPS, sem credenciais ou portas arbitrárias. Outra conta não pode alterar a inscrição, inclusive na corrida de upsert. Respostas 404/410 do provedor desativam a inscrição sem apagar, com Registro atômico; falha do Registro mantém a inscrição anterior.

**O relatório de instalação é um sinal observado, não inventário do sistema operacional:** sem primeira abertura pelo ícone aparece pendente; uma desinstalação posterior não pode ser comprovada pelo servidor.

Configuração necessária na API:

- `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY`: um par estável, guardado como segredo do ambiente; não gerar outro a cada reinício.
- `VAPID_SUBJECT`: contato real, no formato `mailto:...` ou URL HTTPS.
- Front-end servido em HTTPS e na raiz do domínio (`BASE_PATH=/`). Manifest/worker atuais usam essa raiz. Hospedagem em subpasta exige ajuste explícito antes de publicar.
- Manter a API existente em execução persistente. O código atual usa `app.listen()`; publicar apenas o front-end na Vercel não executa os jobs.

O ensaio local `artifacts/api-server/scripts/run-block7-browser-qa.mjs` usa uma organização fictícia, VAPID efêmero e navegador real. Não é importado por produção. Precisa de `.env.test` e `MYASA_TEST_RUNNER=1`. Instalar, abrir pelo ícone, ativar e enviar são etapas reais; não se simulou modo instalado nem permissão. O teste automatizado de VAPID utiliza transporte controlado e identifica isso na própria saída.

Referência de comportamento da plataforma: [WebKit — Web Push em apps web na tela de início](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).

## 3. Busca

`GET /api/search?q=...` filtra no servidor por organização/perfil/escopo, antes de limitar os resultados. Ordem fixa, até três por grupo: Pessoas, Datas, Shows, Documentos e Avisos. Não envia contagem de resultados escondidos.

Pessoas reutiliza `preferredName` como apelido, normaliza acento/caixa, tolera uma inserção/remoção/substituição e prioriza começo do nome. Datas aceitam hoje, ontem, amanhã, `12/09`, `12 de setembro` e ISO, usando a função operacional de São Paulo. Datas inexistentes são rejeitadas.

Ocorrências e motivos de falta **não são consultados pelo índice em nenhum perfil**, inclusive Administração. Documentos em rascunho não aparecem para MEM. A ASA sobe nas condições decididas e permanece no rodapé nos demais casos; não substitui a busca.

`GET /api/directory/people/:id` abre uma projeção mínima do diretório autorizado (nome/apelido/área), não a ficha privada. O 403 já aceito em `/api/users/:id` para MEM lendo outra pessoa continua intacto. Resultados de show, documento e aviso abrem leitura protegida, não um formulário de edição liberado ao elenco.

## 4. Publicação automática e impressão

`services/operational-jobs.ts` roda junto da API existente. Publica rascunhos cujo `publishDeadline` chegou, sob bloqueio de linha, avançando versão e gravando o snapshot no Registro na mesma transação. Não republica em outro ciclo.

Pendência significa: operação inativa, escala sem alocações ativas, vaga OPEN/sem pessoa ou exceção ativa sem resolução, **exceto CONFLICT**. Conflito de horário não trava publicação. A fila de notificação da publicação é criada na mesma transação.

O lembrete é emitido uma vez por compromisso/data/início quando o turno começa e ainda não acabou, respeitando São Paulo. Não foi inventado um antecedente em minutos não definido no pacote.

`services/published-day.ts` reutiliza o compositor aceito da Escala para incluir linhas materiais e compromissos de Livro do Dia, Agenda e atividades; não altera esse motor. Filtra alocações inativas e pessoas de outra organização. Impressão e lembretes compartilham esta leitura.

`GET /api/scales/print-day?date=...` retorna escala publicada no acesso da pessoa, sem ocorrência/motivo privado. `/print/day` agrupa por pessoa, mostra horários e programação em duas colunas, com CSS A4/9pt sem navegação ou botões na impressão. A revisão no navegador usou 40 pessoas e dois compromissos por pessoa. O navegador interno não abriu prévia paginada; a conferência de folha única em Chrome/Edge ou impressora continua pendente.

## Migrações

Aplicadas somente ao Postgres de teste:

1. `0027_block7_delivery_and_pwa.sql`: janela central, fila durável, inscrições, instalações e decisão revertida.
2. `0028_block7_private_tables_rls.sql`: RLS nas quatro tabelas novas, sem política de acesso público. O servidor usa a conexão confiável existente (`postgres`/BYPASSRLS) e mantém a autorização HTTP.

Confirmadas em `drizzle.__drizzle_migrations` com `created_at` 1787524800000 e 1787524801000. Rollbacks existem em `lib/db/drizzle/rollback`; não executados. Exportar os dados antes do rollback 0027. O rollback 0028 reabre a configuração pública anterior e não deve ser executado automaticamente em produção.

Saídas: `.tmp/block7-migrations-20260917.log` e `.tmp/block7-migrations-0028-20260917.log`.

## Verificações e pendências

- Isolado final: `block7-integrity: 72 asserts passed`, exit 0, em `.tmp/block7-targeted-delivery-20260917.log`.
- Rodada completa anterior: 416 anteriores + 64 novos, exit 0, em `.tmp/block7-full-retry-20260917.log`.
- Rodada definitiva: **416 anteriores + 72 novos = 488 asserts, exit 0**, em `.tmp/block7-full-delivery-20260917.log`. Nenhum teste foi removido ou pulado.
- Matriz de autenticação: 292/292 rotas protegidas retornam 401 sem autenticação; 3 rotas públicas, 0 falhas. A extensão do Bloco 6 mantém 33/33 rotas, 192 chamadas HTTP reais e 165/165 combinações rota/perfil; as 9/9 rotas novas do Bloco 7 têm 401 verificado e testes de escopo por operação. Essa cobertura não deve ser confundida com prova de autorização entre organizações para toda rota legada; os achados abaixo permanecem separados.
- Typecheck da API e web: passaram. Build web final: exit 0; permanece o aviso de bundle grande e avisos de sourcemap dos componentes existentes.
- Uma rodada foi interrompida por `Connection terminated unexpectedly`, não por assert. Sua saída foi preservada em `.tmp/block7-full-final-20260917.log`; não foi contabilizada como aprovação.
- Recebimento real de Web Push e paginação impressa: pendentes. Inscrição persistida e transporte controlado passaram, mas não substituem recibo real.
- A pasta disponível não traz a tela 30 de Busca global nem a seção C2 atualizada de instalação. Fluxo funcional segue as decisões escritas; alinhamento visual final depende desses arquivos.

Resumo da saída definitiva:

```text
✓ Segurança de perfis: 16 verificações passaram.
✓ 14 verificações do ciclo de vida de Operações passaram
84 asserts passaram, 0 falharam.
block1-integrity: 16 asserts passed
block2-integrity: 11 asserts passed
block3-integrity: 14 asserts passed
block4-integrity: 13 asserts passed
permission-matrix: 13 asserts passed
block5-integrity: 14 asserts passed
block6-integrity: 221 asserts passed
block7-integrity: 72 asserts passed
Total: 488 asserts; processo encerrado com exit 0.
```

As mensagens de "Falha de Registro solicitada pelo teste" pertencem aos casos de injeção de falha e rollback; não são falhas da suíte. O ensaio de navegador com organização e pessoas fictícias foi encerrado e seus dados foram removidos; nenhum servidor de QA desta entrega ficou em execução.

## Achados legados — separados, sem correção silenciosa

**Não são regressões do Bloco 7; não foram alterados. Não liberar produção sem tratar estes riscos.**

1. Por leitura de código: `GET /api/requests/:id` consulta pelo id sem filtro de organização; ADMIN não recebe bloqueio entre organizações e supervisão não valida área/local/operação neste detalhe. Os comentários reconhecem a validação pendente.
2. Por leitura de código: `GET /api/library/documents/:id/versions` verifica perfil gestor, mas consulta versões pelo documentId sem validar organização ou acesso ao documento.
3. Confirmado por **metadados do banco de teste**, sem ler dados: `users`, `requests`, `library_document_versions`, `history_events`, `scales`, `daily_books`, `occurrences` e `operational_check_ins` têm `anon_select=true` e `relrowsecurity=false`. Se a Data API estiver habilitada, a autorização HTTP não protege este acesso direto. O estado da Data API e da configuração de produção não foi confirmado. As quatro tabelas novas já estão protegidas; expandir RLS às legadas ou desativar a Data API exige decisão explícita, sobretudo se o app antigo a utiliza.

Portanto “suíte passando” não significa “nenhuma superfície de segurança restante”. As matrizes atuais não provam estes dois caminhos legados entre organizações nem substituem RLS do Supabase.
