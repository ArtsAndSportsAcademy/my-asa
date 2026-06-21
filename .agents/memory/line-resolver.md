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

## Livro do Dia é preenchido pelo resolvedor (com fallback de escala)
`daily-book.ts` (generate/regenerate) preenche os `assignments` por PAPEL via
`resolveAssignmentsByRole` (positionId do resolvedor === showBookRole.id === dailyBook.sourceRoleId).
Regra por papel em `createAssignmentsForRole`:
- papel COM linhas e pessoas resolvidas → 1 assignment ASSIGNED por pessoa (deduplicada);
- papel COM linhas, sem pessoas, mas com linha UNCOVERED (ativa hoje sem ninguém disponível) → 1 OPEN (buraco real);
- papel COM linhas todas INATIVAS hoje (ex.: DAY_OF_WEEK fora do dia) → NÃO gera buraco; só honra alocação manual da escala se houver;
- papel SEM linhas → fallback na escala publicada (compat papéis legados).
**Why:** INATIVO ≠ buraco; tratar dia-sem-atuação como OPEN inflava falsos buracos.
**How to apply:** ao mexer na geração, preservar a granularidade de status (hasUncoveredLine/hasActiveLine em RoleResolution), não só "tem pessoa ou não".

## Avanço de rodízio na publicação (tradeoff conhecido)
`advanceRotationCounts` é chamado best-effort no `/publish` (DRAFT→PUBLISHED, acontece uma vez;
regenerate é bloqueado após publicar) e RE-RESOLVE a data para incrementar `config.executionCounts`.
**Why:** publish ocorre uma vez, então não há dupla contagem; re-resolver evita persistir vencedores no schema.
**Tradeoff:** se a disponibilidade mudar ENTRE generate e publish, o contador pode avançar para pessoa
diferente da que ficou no assignment gerado. Aceitável para v1 (publish costuma seguir o generate de perto).
Se virar problema, persistir os vencedores de rodízio na geração e ler no publish.
