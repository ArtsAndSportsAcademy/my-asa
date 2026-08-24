# Relatório prévio — Onda 1 de segurança dos perfis

> Implementação realizada na branch `codex/seguranca-perfis-p0`. Consulte
> `RELATORIO-IMPLEMENTACAO-ONDA-1-SEGURANCA-PERFIS-2026-08-23.md` para o resultado
> e as validações executadas.

Data: 23 de agosto de 2026  
Estado: implementada em branch local; aguardando homologação com banco de Preview  
Escopo: correções P0 de autenticação, autorização, privacidade e isolamento

## 1. Objetivo

Fechar os oito riscos críticos encontrados na auditoria transversal antes de
integrar a nova interface de Pessoas ou liberar novos perfis no Piloto.

Esta onda não redesenha módulos, não migra ainda todos os papéis legados e não
publica nada em Produção. Ela cria uma fronteira de segurança confiável para as
próximas ondas.

## 2. Pré-condição obrigatória

O repositório contém alterações anteriores da Escala sem commit, inclusive em
`users.ts`, no motor de cobertura e na grade web. Antes de alterar autenticação
ou Pessoas:

1. revisar e preservar essas mudanças;
2. restaurar a dependência `@esbuild/win32-x64`;
3. executar os testes possíveis da Escala;
4. registrar a Escala em commit próprio;
5. criar a branch `codex/seguranca-perfis-p0` a partir desse estado preservado.

Não será utilizado reset destrutivo nem descarte de alterações existentes.

## 3. Limites desta onda

### Incluído

- negar conta ativa sem perfil configurado;
- tornar o papel técnico legado `TRAINER` coerente entre token, API e web;
- impedir autoridade de Supervisão herdada entre Operações;
- substituir guardas visuais permissivas por capacidades explícitas;
- corrigir isolamento de Equipes por organização;
- separar projeções privadas e operacionais de Pessoa;
- bloquear imediatamente Pessoas desligadas ou arquivadas;
- validar a expiração de Convidados em autenticação e sessão;
- criar testes transversais para todas essas regras.

### Não incluído

- adicionar ainda o perfil `DIRECTION` ao banco;
- remover os valores legados `SUPERVISOR_A/B` e `TRAINER`;
- redesenhar as telas por perfil;
- criar o perfil próprio aprovado no Figma;
- implementar o fluxo administrativo completo de Pessoas;
- modificar a experiência mobile;
- publicar no banco ou site de Produção.

Direção continuará bloqueada no Piloto até a Onda 2. O objetivo desta etapa é
não criar um novo perfil sobre uma fundação ainda insegura.

## 4. Correções aprováveis por risco

### P0-01 — Conta sem perfil ativo

#### Comportamento atual

`getPrimaryRole` retorna `MEMBER` quando nenhuma função reconhecida é encontrada.

#### Mudança proposta

- o resolvedor de perfil passará a retornar ausência explícita;
- login e refresh responderão `ACCOUNT_UNCONFIGURED` sem emitir token;
- uma conta sem perfil continuará cadastrada, mas não entrará no aplicativo;
- a Administração verá o alerta “acesso sem perfil” e poderá corrigi-lo;
- Pessoa sem conta continuará válida e não será afetada.

Antes de ativar a regra no Piloto, será produzido um relatório das contas ativas
sem papel para evitar bloqueio inesperado.

### P0-02 — Papel técnico legado `TRAINER`

#### Comportamento atual

O banco e a web reconhecem `TRAINER`, mas o token o converte implicitamente em
`MEMBER`.

#### Mudança proposta

- enquanto a migração definitiva não ocorre, `TRAINER` será reconhecido
  explicitamente como papel técnico restrito;
- o token, a API e a web concordarão que essa conta possui somente as
  capacidades mínimas hoje destinadas ao Treinador;
- `TRAINER` nunca concederá autoridade de gestão;
- a Onda 2 migrará essas contas para especialização profissional + acesso
  básico, removendo a duplicidade sem quebrar o Piloto.

### P0-03 — Autoridade por Operação

#### Comportamento atual

O token agrega todas as Operações da Pessoa e mantém somente o papel de maior
prioridade. Esse resumo não prova que a pessoa supervisiona cada Operação.

#### Mudança proposta

Criar `authorization.service.ts` como fonte central de autorização. Para cada
ação sensível, o servidor consultará os papéis ativos no contexto solicitado:

- `ADMIN` mantém autoridade organizacional;
- `SUPERVISOR_A/B` somente prova Supervisão na Operação vinculada àquele papel;
- papel `MEMBER` em outra Operação nunca amplia Supervisão;
- responsabilidade e delegação somente ampliam as ações registradas e dentro do
  seu escopo;
- `operationIds` do token será tratado como informação de navegação, nunca como
  prova suficiente de autoridade.

A API usará negação por padrão quando a combinação ação, recurso e Operação não
estiver prevista.

### P0-04 — Guardas de rotas na web

#### Comportamento atual

`TrainerBlockedRoute` permite a entrada de qualquer pessoa autenticada que não
tenha papel `TRAINER`. Isso inclui Membros em páginas com aparência e ações
administrativas.

#### Mudança proposta

- substituir `TrainerBlockedRoute` por `CapabilityRoute`;
- consultar capacidades efetivas em `/users/me/permissions`;
- diferenciar leitura e gestão, em vez de liberar a página inteira pelo nome do
  papel;
- mostrar `Acesso restrito` ao digitar uma URL não permitida;
- manter a API como autoridade final mesmo quando o menu esconder a rota.

Capacidades mínimas desta onda:

| Capacidade | Administração | Supervisão no escopo | Membro | Trainer legado |
|---|---:|---:|---:|---:|
| `PEOPLE_ADMIN` | sim | não | não | não |
| `OPERATION_ADMIN` | sim | não | não | não |
| `SCALE_MANAGE` | sim | conforme papel/delegação | não | não |
| `SHOW_BOOK_MANAGE` | sim | conforme responsabilidade | não | não |
| `AGENDA_MANAGE` | sim | no escopo | não | não |
| `AGENDA_READ` | sim | no escopo | conforme visibilidade | conforme visibilidade |
| `RESPONSIBILITY_MANAGE` | sim | somente ação delegada | não | não |
| `ASA_USE` | sim | sim | sim | sim, com contexto restrito |
| `SELF_SERVICE` | sim | sim | sim | sim |

Meu Dia, Mural e ASA podem continuar compartilhando componentes, mas os dados e
ações serão resolvidos conforme a capacidade e o contexto da pessoa.

### P0-05 — Isolamento entre organizações

#### Comportamento atual

Consultas de contexto carregam todos os grupos antes de responder. Administração
pode receber grupos pertencentes a outra organização.

#### Mudança proposta

- criar `loadOrganizationGroups(organizationId)`;
- filtrar diretamente por `organizationId` quando preenchido;
- para registros legados sem organização direta, validar a Operação proprietária
  por `organizationId`;
- utilizar o mesmo helper em `/organizations/current`,
  `/operational-groups` e `getUserContext`;
- nunca buscar todos e confiar somente em filtragem posterior no navegador;
- adicionar teste com duas organizações e nomes de Equipe distintos.

### P0-06 — Projeções privadas de Pessoa

#### Comportamento atual

`safeUser` remove apenas a senha criptografada. Outros dados privados continuam
na resposta genérica.

#### Mudança proposta

Substituir a resposta genérica por quatro projeções explícitas:

| Projeção | Uso | Campos privados |
|---|---|---|
| `AdminPerson` | Administração de Pessoas | conforme autorização administrativa |
| `SupervisorPerson` | consulta dentro do alcance | sem `adminNotes`, nascimento completo e dados internos |
| `SelfProfile` | própria Pessoa | próprios contatos e dados editáveis; nunca `adminNotes` |
| `PublicPersonCard` | Escala, atividade, Equipe e conversa | id, nome de uso, foto e função contextual mínima |

Regras adicionais:

- Supervisão só consulta Pessoas cobertas pelo seu alcance comprovado;
- Membro só consulta o próprio perfil completo;
- cartões de terceiros não expõem contato por padrão;
- busca, contadores e paginação obedecem ao mesmo escopo;
- o texto do Figma sobre observação privada será alinhado à primeira entrega:
  somente Administração autorizada.

### P0-07 — Desligamento e arquivamento

#### Comportamento atual

A autenticação verifica a situação da conta, mas não impede de forma confiável
`personStatus = LEFT` ou `ARCHIVED`.

#### Mudança proposta

- login e refresh negarão `LEFT` e `ARCHIVED`;
- `requireAuth` validará a situação atual da conta e da Pessoa no banco antes de
  aceitar uma requisição autenticada;
- arquivamento ou desligamento revogará refresh tokens e invalidará o acesso
  imediatamente no Piloto;
- `ON_LEAVE` poderá continuar acessando quando a conta estiver ativa, mas ficará
  fora da elegibilidade operacional durante o afastamento;
- a mudança de ciclo de vida continuará preservando histórico.

Na primeira versão segura, a consulta ao banco em cada requisição autenticada é
aceitável. Otimização com cache ou versão de sessão poderá vir depois sem reduzir
a proteção.

### P0-08 — Expiração de Convidado

#### Comportamento atual

`visitUntil` só provoca desativação quando alguém lista Pessoas.

#### Mudança proposta

- login, refresh e validação de sessão verificarão `visitUntil`;
- Convidado com data anterior ao dia atual será bloqueado imediatamente;
- o serviço registrará o motivo `GUEST_ACCESS_EXPIRED` e revogará sessões;
- a expiração não apagará a Pessoa nem seu histórico;
- a Administração poderá reativar o mesmo cadastro e definir uma nova data;
- abrir uma listagem deixará de ser responsável por aplicar segurança.

Datas usarão a zona da organização/Operação configurada, evitando expiração no
dia errado por UTC.

## 5. Arquitetura técnica proposta

### 5.1 Autenticação

Fluxo após validar a senha ou refresh token:

1. carregar conta e Pessoa na organização;
2. validar situação da conta;
3. validar `personStatus`;
4. validar prazo do Convidado;
5. carregar papéis ativos;
6. negar ausência de perfil;
7. emitir token curto com identidade e contexto resumido;
8. registrar auditoria sem dados sensíveis.

### 5.2 Autorização

O novo serviço exporá operações semelhantes a:

- `resolveEffectiveProfile(userId, operationId?)`;
- `getCapabilities(userId, operationId?)`;
- `authorizeAction(actor, action, resource)`;
- `loadScopedPersonProjection(actor, targetId)`;
- `loadOrganizationGroups(organizationId)`.

Nenhum endpoint sensível deverá implementar uma versão própria e divergente da
mesma regra.

### 5.3 Compatibilidade

- os enums existentes permanecem nesta onda;
- `SUPERVISOR_A/B` continuam válidos, mas escopados corretamente;
- `TRAINER` continua reconhecido somente como compatibilidade temporária;
- rotas e componentes existentes podem manter seus caminhos para evitar quebra
  de links;
- Escala continua usando `team_memberships` para elegibilidade;
- autorização não transforma `user_roles` novamente em fonte do elenco.

## 6. Arquivos previstos

### API

- `artifacts/api-server/src/lib/auth.service.ts`;
- `artifacts/api-server/src/lib/jwt.service.ts`;
- `artifacts/api-server/src/middlewares/auth.ts`;
- novo `artifacts/api-server/src/services/authorization.service.ts`;
- `artifacts/api-server/src/routes/auth.ts`;
- `artifacts/api-server/src/routes/organization.ts`;
- `artifacts/api-server/src/routes/users.ts`;
- ajustes pontuais nas rotas sensíveis que ainda confiam apenas em
  `role + operationIds`;
- contrato OpenAPI e clientes gerados.

### Web

- `artifacts/web-admin/src/App.tsx`;
- `artifacts/web-admin/src/contexts/AuthContext.tsx`;
- `artifacts/web-admin/src/components/admin-layout.tsx`;
- novo guard de capacidades e modo de leitura onde necessário;
- mensagens específicas para acesso não configurado, expirado e restrito.

### Testes

- novo `artifacts/api-server/tests/profile-authorization.test.ts`;
- novo teste de projeções de Pessoa;
- ampliação dos testes de Operações, Escala e Livro do Dia;
- testes de rotas web para URL digitada e navegação por capacidade.

Não há migração destrutiva prevista nesta onda. Caso a inspeção revele que um
índice ou campo técnico é indispensável, ele será relatado antes de ser criado.

## 7. Testes de aceite por risco

### Conta e sessão

- conta ativa sem papel não recebe token;
- conta somente `TRAINER` recebe contexto restrito coerente;
- Pessoa `LEFT` ou `ARCHIVED` não entra nem renova token;
- token existente deixa de funcionar após arquivamento;
- `ON_LEAVE` entra quando a conta está ativa, sem voltar à Escala;
- Convidado válido entra; expirado não entra; reativado com nova data volta.

### Escopo

- Supervisor de Snowland administra Snowland;
- o mesmo usuário como Membro de Hotelaria não administra Hotelaria;
- Supervisor de outra Operação recebe `403`;
- delegado de Escalas altera somente a Operação e ação recebidas;
- delegação expirada ou revogada não concede acesso;
- Membro não abre uma URL administrativa manualmente.

### Privacidade e organização

- Supervisor não recebe `adminNotes`;
- Membro não recebe `adminNotes` nem contatos de terceiros;
- Administração da organização A não recebe Equipes da organização B;
- busca, paginação e contadores não denunciam Pessoas fora do escopo;
- `/users/me/context` retorna somente estrutura da organização autenticada.

### Regressão

- Pessoa ativa sem login continua escalável quando elegível;
- Convidado ativo continua escalável;
- Professor e Treinador continuam fora do elenco automático;
- publicação e republicação da Escala continuam funcionando;
- Livro do Dia mantém a autoridade por show e Operação;
- login da conta Administrador do Piloto continua funcionando.

## 8. Validação técnica obrigatória

Antes de gerar Preview:

- restaurar `@esbuild/win32-x64` e comprovar a execução dos testes;
- executar typecheck de API e web;
- executar testes novos de perfis e privacidade;
- executar testes existentes de Operações e Livro do Dia;
- executar regressão da Escala por perfil;
- executar build local completo;
- executar `git diff --check`;
- revisar respostas HTTP para ausência de dados privados;
- testar com contas distintas e duas organizações de teste.

Typecheck isolado não será considerado validação funcional.

## 9. Ordem de implementação

1. preservar e fechar as alterações atuais da Escala;
2. criar os testes que reproduzem os oito riscos;
3. corrigir autenticação e sessão;
4. criar a política central de autorização;
5. corrigir isolamento organizacional;
6. criar projeções seguras de Pessoa;
7. substituir guardas permissivas da web;
8. executar regressão completa;
9. publicar somente um Preview;
10. testar com as contas do Piloto e produzir relatório pós-implementação.

## 10. Critérios para interromper a onda

A implementação deverá parar e retornar para decisão se:

- uma correção exigir descartar alterações da Escala;
- surgir migração destrutiva de papéis ou Pessoas;
- uma regra exigir escolher entre impedir o trabalho atual e expor dados;
- o banco Piloto não puder ser copiado ou recuperado;
- não for possível executar os testes por bloqueio de ambiente;
- a correção ampliar o escopo para Produção.

## 11. Aprovação solicitada

Ao aprovar este relatório, fica autorizado somente:

- implementar os oito fechamentos P0 em branch separada;
- criar e executar testes locais;
- auditar dados do Piloto sem alterar registros reais;
- gerar Preview após os testes passarem;
- testar com contas controladas.

Continuam proibidos sem novo aceite:

- aplicar migração ou correção em Produção;
- liberar Direção ou demais perfis no Piloto;
- integrar a nova interface de Pessoas;
- apagar ou reescrever histórico;
- remover papéis legados do banco.
