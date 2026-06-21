---
name: Resolvedor de linhas por data (Livro do Show)
description: Decisões de design do resolvedor que computa quem ocupa cada linha numa data
---

# Resolvedor por data (line-resolver.ts)

Serviço `artifacts/api-server/src/services/line-resolver.ts` resolve quem ocupa cada linha
do Livro do Show numa data específica.

## Decisões duráveis
- **Indisponibilidade = união de `restrictionsTable` ∪ `folgasTable`** ativas cobrindo a data
  (status ACTIVE, range inclusivo). `folgasTable` é escopada por `operationId`; `restrictionsTable`
  NÃO tem coluna operationId — filtra-se só por status+data, e a checagem só importa para userIds
  já referenciados nas configs, então não há vazamento entre operações.
  **Why:** coverage-engine.ts só usava restrictions; folgas/atestado também tiram a pessoa do dia.
- **Resolvedor é PURO** (não persiste). Para ROTATION devolve `rotationAdvanceUserId` para quem
  efetivar a escala incrementar o contador depois. O endpoint `/resolve` é preview read-only.
  **Why:** conferência no admin não pode alterar contadores de rodízio.
- **Resolução é por DATA, não por evento** → "fixo do dia" é naturalmente honrado: a mesma pessoa
  sai para todos os shows do mesmo dia. Rodízio por-evento (ex: matinê vs noite girando) exigiria
  resolução por evento — não implementado; confirmar com usuário se necessário.
- **Helpers `buildShowBookTree` + `collectUserIdsFromConfig` vivem no line-resolver.ts** e show-book.ts
  importa de lá. **Why:** evita import circular (rota → serviço → rota).
- **DAY_OF_WEEK**: weekday via `new Date(`${date}T00:00:00Z`).getUTCDay()` (0=Dom..6=Sáb) para evitar
  shift de timezone em strings YYYY-MM-DD. Sem substituto: pessoa do dia indisponível → UNCOVERED.
  Sem assignment no dia → INACTIVE ("não atua neste dia"). Compat: config antiga só com `days[]`
  (sem pessoa) → UNCOVERED "sem pessoa definida".
- Endpoint `GET /show-books/:id/resolve?date=YYYY-MM-DD` valida data de calendário real
  (reserializa e compara) além do regex.

## Daily Book NÃO usa as configs das linhas
O Livro do Dia (`daily-book.ts`) é um SNAPSHOT gerado de Show Book + Escala PUBLICADA: as
atribuições (`assignments`) vêm da **Escala** (scale allocations → positions), não das configs
de linha. Logo "alimentar o Livro do Dia" com o resolvedor = trocar o fluxo escala→resolvedor
na geração — mudança de longo alcance que exige consentimento do usuário, não fazer silenciosamente.

## Status do que falta no Task #97
Feito: resolvedor + endpoint + hook `useResolveShowBook` + painel "Conferir por data" no web-admin
+ flag "fixo do dia" (config.fixedForDay em ROTATION, default true; badge na conferência).
Falta: alimentar Livro do Dia (decisão de arquitetura pendente) e visão do membro (web+mobile leitura).
