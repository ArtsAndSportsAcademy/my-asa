# Bloco 6 — entidades HTTP e integrações

Escopo: backend. Nenhuma tela nova, deploy ou trabalho do Bloco 7.

## Contratos disponíveis

Todos os caminhos abaixo têm prefixo `/api`, autenticação e organização do usuário
resolvidas no servidor, não confiadas ao corpo da requisição.

| Entidade | Rotas |
|---|---|
| Ocorrência | `GET/POST /occurrences`; `GET/PATCH/DELETE /occurrences/:id`; `PATCH /occurrences/:id/state` |
| Personagem | `GET/POST /characters`; `PATCH/DELETE /characters/:id`; `GET /characters/:id/resolve` |
| PersonagemElenco | `GET/POST /characters/:id/cast`; `PATCH/DELETE /characters/:id/cast/:castId` |
| Sessão | `GET/POST /show-books/:showId/sessions`; `PATCH/DELETE /show-books/:showId/sessions/:sessionId` |
| Área | `GET/POST /areas`; `PATCH/DELETE /areas/:id` |
| Local | `GET/POST /locations`; `PATCH/DELETE /locations/:id` |
| Supervisão por área/local | `GET /areas/:id/local-supervisors`; `PUT/DELETE /areas/:id/locations/:locationId/supervisor` |
| Locais da operação | `GET/PUT /operations/:operationId/locations` |
| Área e local padrão da pessoa | `PUT /users/:id/operational-scope` |

São 33 combinações de método/caminho novas. `DELETE` é sempre desativação ou
encerramento; as linhas continuam existentes e ligadas ao Registro.

### Ocorrências

Criação: `{ personId, date, type, description, reason }`. Sem check-in obrigatório.
Transição: `{ state: "em_analise" | "resolvida", reason }`, respeitando a sequência
`aberta → em_analise → resolvida`. Criação, edição, transição e desativação exigem
motivo não vazio, inclusive depois de remover espaços. MEM acessa as próprias;
SUP acessa pessoas de sua área/local; ADMIN acessa todas da organização; DIR lê.
O detalhe histórico continua disponível após desativar, mas sai da lista ativa.

### Personagens e sessões

Personagens: `name`, `locationId`, `mode: "titular" | "rodizio"`. Busca pode filtrar
`locationId`. Elenco: `personId`, `order`, `timesDone`; o contador usa o mesmo
ledger por personagem/pessoa/dia do Bloco 1. A resolução recebe `operationId` e
`date`; se a data faltar, usa hoje em America/Sao_Paulo. É uma prévia da fila,
não uma publicação nem incremento de contador.

Sessões: `startTime`, `endTime`, `callTime` opcional. O banco continua impondo
`endTime > startTime`; `callTime: null` remove a chamada opcional. Estrutura e
autoridade do Livro do Show continuam seguindo operação/responsável existentes.

### Configuração necessária antes de usar com a equipe

1. Cadastrar/conferir áreas e locais reais.
2. Relacionar os locais à operação usando IDs, via `PUT /operations/:id/locations`.
3. Atribuir a área e o local padrão das pessoas pelo endpoint de escopo.
4. Atribuir cada supervisor à combinação exata de área e local. Os nomes Victor
   e Stephani usados nos testes são fixtures; não foram criadas contas reais.
5. Enviar `areaId` e `locationId` ao gerar Escalas. Depois que uma organização
   adota a supervisão explícita, omitir os dois campos não autoriza escrita SUP.
   O cadastro legado sem área/local permanece preservado para a Administração.

O JSON legado de locais da operação não foi apagado. O endpoint novo usa a
relação `operation_locations`; consumidores antigos continuam compatíveis.
No backfill de Área, apenas uma associação inequívoca é inferida. Mais de uma
área por pessoa requer escolha humana; não se escolhe pelo menor UUID.

## Integrações

- `GET /show-books/:id/resolve` devolve `resolution` e `conflicts`.
- Gerar/regenerar Livro do Dia devolve `dailyBook`, `conflicts` e
  `conflictDetection.status` (`complete` ou `unavailable`). A indisponibilidade
  do detector é explícita; não transforma sucesso do salvamento em bloqueio nem
  finge que não há conflito.
- A prévia preserva `ciente` quando os horários não mudaram. Uma combinação nova
  volta a alertar. Não há troca automática de pessoa.
- As escritas das entidades novas gravam Registro na mesma transação. Um motivo
  opcional informado é preservado; se estiver vazio, o Registro guarda o reflexo
  calculado a partir de antes/depois. Falhar o Registro desfaz a alteração.
- `GET /operational-panel` acrescenta `checkIns` e `occurrences` aos indicadores
  de cobertura. Esses agregados não contêm nomes, descrições ou motivos.

## Migrações do bloco

- `0025_block6_areas_and_http_entities.sql`: áreas, vínculos de supervisão e de
  locais da operação, referências nas pessoas/Escalas, perfil DIR e flags ativas.
- `0026_block6_occurrence_lifecycle.sql`: flag `active` da ocorrência para remoção
  lógica, sem apagar histórico.

Aplicação realizada somente no Postgres configurado em `.env.test`. Nenhum deploy
ou alteração do banco de produção foi executado. A validação de dados encontrou
zero pessoas com associação legada ambígua no banco de teste. A migração 0025
ainda não foi liberada para produção; seu backfill foi restringido a associações
inequívocas durante esta revisão.

## Segurança: o que o teste prova

A sondagem antiga de perfis usava um header que encerrava a requisição dentro de
`requireAuth`. Isso não demonstrava autorização do handler. Esse atalho foi
retirado, sem substituir a autenticação real por mocks.

- Inventário global: todas as rotas protegidas são chamadas sem token e precisam
  responder 401.
- Matriz legada: mantém os casos concretos de MEM, DIR, grupo/operação e
  organização; não equivale a provar toda permissão de toda rota antiga.
- Matriz nova: 33/33 rotas do Bloco 6 chegam aos handlers, com recursos existentes,
  perfis reais e expectativas de status específicas. São cinco perfis técnicos
  (ADMIN, DIR, SUPERVISOR_A, SUPERVISOR_B e MEMBER), correspondentes aos quatro
  perfis operacionais. Há provas positivas e negativas, projeção de dados,
  isolamento entre organizações e rollback de Registro.
  Foram verificadas todas as 165 combinações de rota/perfil em 192 chamadas HTTP.
- Victor salva uma Escala existente de Snowland com 200 e recebe 403 no
  Acquamotion; Stephani tem o inverso. Omissão de área/local também é testada.

O relatório não deve transformar a varredura global de 401 em uma alegação de
cobertura exaustiva de autorização das rotas antigas.

### Brechas identificadas e fechadas nesta revisão

- Criar ocorrência para pessoa de outra organização usando um perfil ADMIN.
- Resolver personagem de outra organização usando uma operação local válida.
- Contornar o limite de local da Escala omitindo área/local do corpo.
- Alterar alocação ou resolver exceção de Escala sem passar pelo mesmo guard de
  autoridade utilizado nas demais escritas de Escala.
- Validar supervisor/local com um array vazio tratado como valor verdadeiro.
- DIR alcançar escrita de show/sessão por estar marcado como responsável.

Nas rotas novas, identificadores fora do escopo devolvem 403. O comportamento
legado de 404 anti-enumeração do Livro do Show foi mantido e é testado.

## Resultado da execução

Execução consolidada concluída em 17/09/2026, contra o Postgres real de teste.
Saída completa: `.tmp/block6-full-final-20260917.log`. Código de saída: 0.

```text
Segurança de perfis: 16 verificações passaram.
Ciclo de vida de Operações: 14 verificações passaram.
Livro do Dia: 84 asserts passaram, 0 falharam.
block1-integrity: 16 asserts passed
block2-integrity: 11 asserts passed
block3-integrity: 14 asserts passed
block4-integrity: 13 asserts passed
permission-matrix: 283/283 rotas protegidas verificadas sem autenticação (401);
3 públicas; 0 falhas
permission-matrix: 13 asserts passed
block5-integrity: 14 asserts passed
block6-http-matrix: 33/33 rotas novas; 192 chamadas HTTP reais;
165/165 combinações rota/perfil; 0 rotas fora
block6-integrity: 221 asserts passed
```

Total: 416 verificações passaram; os 168 asserts anteriores continuam passando.
As mensagens de falha de Registro presentes no log são injeções intencionais dos
testes de rollback e não falhas da suíte. As fixtures da rodada final foram
removidas durante o encerramento bem-sucedido dos testes.

Migrações confirmadas no banco de teste: 0025 e 0026. A consulta da tabela de
migrações e a revalidação transacional do SQL final de 0025 ficaram em
`.tmp/block6-migrations-20260916.log`. Typecheck da API: passou.

Bloco 7 não iniciado. Nenhum deploy foi realizado.
