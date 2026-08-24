# Relatório de implementação — Onda 1: segurança de perfis

Data: 23/08/2026  
Branch: `codex/seguranca-perfis-p0`  
Destino autorizado: somente branch local/teste/Preview; sem Produção.

Estado: revisada e aprovada pela responsável do produto em 23/08/2026.
Próxima etapa autorizável: homologação com banco isolado de Preview.

## Resultado

A Onda 1 foi implementada no núcleo de autenticação, autorização, Pessoas e
proteção de rotas da interface. O objetivo desta entrega é impedir que um perfil
mal configurado ou um registro pertencente a outra organização receba acesso
por padrão.

## O que mudou e por quê

1. Conta sem perfil ativo deixa de virar `MEMBER` automaticamente.
   - Agora o login e a renovação recusam a conta com `ACCOUNT_UNCONFIGURED`.
   - Evita liberar uma conta incompleta por uma configuração implícita.

2. O papel legado `TRAINER` passou a ter capacidades explícitas.
   - Mantido temporariamente para compatibilidade nesta Onda.
   - Não herda Escala, ASA ou áreas do elenco apenas por ser autenticado.

3. Sessões passaram a consultar o estado atual no banco.
   - Conta inativa, pessoa `LEFT`/`ARCHIVED` e convidado vencido são recusados.
   - Refresh tokens são revogados quando o acesso deixa de ser válido.
   - Mudanças de perfil e de operação deixam de esperar o JWT antigo expirar.

4. Autorização foi centralizada por capacidades.
   - Perfis ativos são filtrados pela organização real da pessoa.
   - IDs de operação contidos no token são apenas contexto de navegação.
   - Foi criada a rota `GET /users/me/permissions`.

5. A interface passou a usar capacidades emitidas pelo servidor.
   - O antigo guard permissivo `TrainerBlockedRoute` foi removido.
   - As rotas sensíveis agora exigem uma capacidade explícita.
   - As capacidades são renovadas por `GET /auth/me` e persistidas na sessão web.

6. Pessoas passaram a ter projeções seguras.
   - Administração: todos os campos administrativos, nunca o hash de senha.
   - Supervisão: sem observações administrativas e sem data de nascimento.
   - Próprio perfil: sem observações administrativas.
   - Cartão público: respeita a visibilidade de e-mail e telefone.

7. Escopo de organização foi endurecido.
   - Grupos do contexto atual não são mais carregados globalmente.
   - Um perfil ligado por engano a uma operação de outra organização não concede
     autoridade na organização atual.
   - Supervisor só consulta pessoas de grupos que efetivamente supervisiona.

8. Arquivamento/desligamento passou a cortar acesso imediatamente.
   - Alterar a pessoa para `LEFT` ou `ARCHIVED` inativa a conta e revoga sessões.
   - Uma conta de pessoa desligada/arquivada não pode ser ativada isoladamente.

## Arquivos principais

- `artifacts/api-server/src/lib/authorization.service.ts`
- `artifacts/api-server/src/lib/person-projection.ts`
- `artifacts/api-server/src/lib/auth.service.ts`
- `artifacts/api-server/src/middlewares/auth.ts`
- `artifacts/api-server/src/routes/auth.ts`
- `artifacts/api-server/src/routes/organization.ts`
- `artifacts/api-server/src/routes/users.ts`
- `artifacts/web-admin/src/App.tsx`
- `artifacts/web-admin/src/contexts/AuthContext.tsx`
- `artifacts/api-server/tests/profile-authorization.test.ts`

## Validações executadas

- TypeScript API: aprovado.
- TypeScript web: aprovado.
- Matriz de segurança: 16 verificações aprovadas.
- Build API: aprovada.
- Build web: aprovada.
- `git diff --check`: aprovado.

A build web manteve avisos já existentes de sourcemap e tamanho de bundle; não
houve erro de build.

## Limitação de homologação

A suíte antiga de integração foi compilada, mas não pôde executar os cenários que
dependem de PostgreSQL porque não existe servidor local disponível em
`localhost:5432`. Antes de publicar em Produção, executar a suíte completa contra
um banco isolado de teste/Preview.

## Fora desta Onda

- Criar o perfil definitivo de Direção.
- Migrar/remover os enums legados `SUPERVISOR_A`, `SUPERVISOR_B` e `TRAINER`.
- Substituir toda a matriz antiga de papéis por perfis + responsabilidades.
- Aplicar a nova interface de todos os perfis no módulo Pessoas.
- Fazer deploy em Produção.

## Recomendação de liberação

1. Criar banco isolado de Preview.
2. Rodar a suíte completa de integração.
3. Testar manualmente: Administração, Supervisor, Membro, Treinador legado,
   convidado vencido e conta sem perfil.
4. Somente depois autorizar Preview compartilhado; Produção exige nova aprovação.
