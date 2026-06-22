---
name: Livro do Dia — gerar por Livro do Show + data
description: Por que a geração do Livro do Dia NÃO mudou o esquema e usa um evento de agenda interno
---

O Livro do Dia gera-se por **Livro do Show + data** (a operação deriva do show book), reconhecendo folgas/restrições pela data. O utilizador nunca escolhe evento/agenda.

**Regra:** o endpoint `POST /daily-book/generate` aceita dois modos no mesmo body — `{showBookId, date}` (novo) e `{agendaEventId}` (legado). Payload com ambos é rejeitado com 400. No modo por data, reutiliza-se (ou cria-se) nos bastidores um evento de agenda interno (`type SHOW`, `visibility MANAGEMENT`) só para carregar showBook+operação+data; todo o pipeline a jusante (resolver por data, regenerate, publish/rotação) fica intacto.

**Why:** o deploy NÃO corre migrações (index.ts só corre runProdBootstrap gated por RESET_PROD_DB, que é reset destrutivo; .replit não tem passo migrate) e prod é só-leitura. Mudar o esquema (agendaEventId nullable + colunas date/operationId) partiria a app publicada. A abordagem "evento interno" é prod-safe (zero DDL). Trade-off aceite: cria eventos internos (cosmético na agenda); o reuso por (showBookId, date, operationId) evita duplicados na maioria dos casos (sem unique constraint, corrida pode duplicar — risco residual aceite).

**How to apply:** ao tocar no generate, manter os dois modos e a rejeição de ambíguo. Auth de não-managers no modo legado DEVE validar contra a operação REAL do evento carregado (`event.operationId`), nunca um operationId vindo do cliente — confiar no body permite bypass cross-operation.
