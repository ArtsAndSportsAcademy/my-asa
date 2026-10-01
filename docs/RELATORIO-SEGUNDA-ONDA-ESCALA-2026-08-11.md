# Relatório para aprovação — Módulo Escalas

Data da revisão: 12 de agosto de 2026  
Situação: aguardando aprovação para testes finais e publicação  
Branch: `codex/fundacao-organizacional-github`

## 1. Objetivo desta atualização

Alinhar o módulo Escalas à estrutura organizacional já aprovada para o My ASA:

- as pessoas pertencem à ASA;
- cada pessoa pode ter uma Equipe principal e colaborar com outras Equipes;
- as Equipes atendem uma, várias ou todas as Operações;
- o perfil de acesso não deve ser usado para decidir quem pertence ao elenco;
- administradores, professores, treinadores e outros profissionais especiais não
  devem aparecer automaticamente como pessoas escaláveis;
- supervisores só podem administrar Escalas nas Operações pelas quais são
  responsáveis, salvo delegação válida.

Esta atualização preserva o fluxo já existente de criação, edição, publicação,
republicação e consulta da Escala.

## 2. Problemas encontrados na versão atual

### 2.1 Pessoas da Escala eram definidas pelo acesso ao sistema

A versão publicada ainda usa os papéis de acesso (`ADMIN`, `SUPERVISOR`,
`MEMBER`) como fonte principal para descobrir quem pode aparecer na Escala.

Isso mistura duas regras diferentes:

- **Equipe:** onde a pessoa trabalha e com quem ela atua;
- **Papel de acesso:** o que a pessoa pode visualizar ou editar no aplicativo.

Na prática, essa mistura pode esconder uma pessoa que deveria ser escalada ou
mostrar alguém que não pertence ao elenco operacional.

### 2.2 Supervisor poderia receber autoridade fora da sua Operação

O sistema reconhecia o papel geral de supervisor antes de validar em qual
Operação ele realmente possuía responsabilidade. Isso poderia permitir acesso
indevido a uma Escala de outra Operação.

### 2.3 A interface ainda filtrava pessoas pelos vínculos antigos

Mesmo com a nova estrutura de Equipes, a tela continuava filtrando os nomes da
grade usando os vínculos antigos de papéis por Operação.

## 3. Mudanças propostas para esta publicação

### 3.1 Equipes passam a definir o elenco disponível

Ao abrir uma Operação, o sistema buscará pessoas com vínculo ativo em Equipes
que atendam essa Operação.

Serão respeitados:

- Equipe de uma única Operação;
- Equipe que atende várias Operações;
- Equipe que atende todas as Operações da ASA;
- data inicial e final do vínculo;
- situação ativa da Equipe;
- situação ativa da pessoa;
- Equipe principal e Equipes adicionais.

Exemplo: uma bailarina cuja Equipe principal atende Snowland poderá aparecer na
Escala da Hotelaria quando estiver vinculada também a uma Equipe que cobre essa
Operação.

### 3.2 Pessoas sem login continuam podendo ser escaladas

A situação profissional da pessoa será considerada separadamente da situação
da conta de acesso. Assim, uma pessoa ativa na ASA poderá ser escalada mesmo que
ainda não tenha login ou que o seu acesso ao aplicativo esteja desativado.

Isso atende casos como convidados cadastrados, participantes temporários e
profissionais que precisam constar na programação sem utilizar o sistema.

### 3.3 Exclusão centralizada de pessoas não escaláveis

Continuam fora da seleção automática:

- administradores;
- professores;
- treinadores;
- fisioterapeutas;
- preparadores físicos;
- técnicos operacionais e outros profissionais marcados como especiais.

Convidados e performers continuam escaláveis quando estiverem ativos e
vinculados a uma Equipe que atende a Operação.

Essa regra será usada tanto pela grade quanto pelo motor de cobertura, evitando
que cada parte do sistema decida de uma forma diferente.

### 3.4 Autoridade do supervisor será validada por Operação

Para gerar, editar, publicar, republicar, regenerar, duplicar ou excluir uma
Escala:

- o administrador mantém autoridade global;
- o supervisor precisa ter papel ativo naquela Operação; ou
- a pessoa precisa possuir delegação ativa com a responsabilidade `SCALES`.

Um supervisor da Snowland não poderá alterar a Escala do Acquamotion apenas por
ser supervisor da ASA. Ele poderá fazê-lo somente se também for supervisor do
Acquamotion ou receber a delegação correspondente.

Delegações permanentes e temporárias continuam aceitas.

### 3.5 A tela passa a usar a abrangência real das Equipes

A lista de pessoas disponível na grade será filtrada pelas Operações cobertas
pelas Equipes de cada pessoa. O vínculo antigo será mantido apenas como fallback
durante a transição dos dados.

Esse fallback evita que pessoas desapareçam da Escala antes de os cadastros de
Equipes serem concluídos.

## 4. O que não muda nesta publicação

Esta atualização não redesenha a página nem conclui todas as funções futuras do
Módulo Escalas. Permanecem como estão:

- visual atual da grade;
- criação da Escala por dia;
- edição manual de blocos;
- publicação antes do horário limite configurável;
- republicação emergencial;
- histórico das publicações;
- integração já existente com atividades, Agenda e Livro do Dia;
- cores e ícones das atividades;
- regras atuais de notificações.

Também não entram nesta publicação:

- geração mensal de Escalas;
- edição com experiência completa de planilha/Excel;
- automação integral da Escala pela inteligência artificial;
- montagem automática de todos os Livros do Show;
- revisão visual completa da página;
- migração automática de todos os cadastros antigos para Equipes.

Esses itens devem ser analisados em ondas posteriores para não misturar a
fundação de dados com mudanças grandes de experiência e automação.

## 5. Dados e compatibilidade

- Nenhuma tabela será apagada.
- Nenhum usuário ou histórico será excluído.
- Nenhuma Escala publicada será removida.
- O banco antigo do Replit não será alterado.
- As alocações existentes continuarão apontando para as mesmas pessoas.
- Os vínculos antigos permanecem temporariamente como compatibilidade.

Antes do teste funcional, o banco piloto precisará receber os cadastros reais
das Equipes e seus vínculos. Hoje ele contém apenas a organização ASA, as
Operações Snowland, Acquamotion e Hotelaria e o administrador inicial.

## 6. Riscos conhecidos e prevenção

### Pessoa não aparece na Escala

Pode ocorrer se ela ainda não estiver vinculada a uma Equipe que cobre a
Operação. O fallback reduz esse risco durante a transição, mas o cadastro das
Equipes precisa ser revisado antes do piloto com elenco real.

### Pessoa aparece em Operação indevida

Pode ocorrer se uma Equipe for configurada como abrangência `ALL` ou receber uma
Operação adicional incorreta. O teste deve conferir a abrangência de cada
Equipe antes da publicação para o elenco.

### Supervisor não consegue editar

Pode ocorrer se o papel do supervisor ou sua delegação não estiver associado à
Operação correta. O sistema deverá negar a alteração por segurança e a gestão
poderá corrigir o vínculo.

## 7. Testes obrigatórios antes da publicação

### Verificações técnicas

- validar TypeScript da API;
- validar TypeScript da interface;
- executar testes automatizados relacionados à Escala;
- validar que não houve alteração acidental em Agenda e Livro do Dia;
- testar geração e consulta usando o novo banco piloto.

### Cenários funcionais

1. Administrador cria e publica uma Escala em qualquer Operação.
2. Supervisor da Snowland edita a Escala da Snowland.
3. Supervisor da Snowland não edita a Escala do Acquamotion sem autorização.
4. Delegado ativo edita a Escala durante a vigência da delegação.
5. Delegado fora da vigência não edita a Escala.
6. Performer ativo e vinculado à Equipe aparece na Operação correta.
7. Professor ou treinador não aparece automaticamente como escalável.
8. Administrador não aparece como membro do elenco.
9. Convidado ativo pode ser incluído na Escala.
10. Pessoa sem login, mas profissionalmente ativa, pode ser incluída.
11. Pessoa afastada, desligada ou arquivada não aparece como disponível.
12. Equipe com abrangência múltipla disponibiliza seus membros nas Operações
    selecionadas, sem vazamento para as demais.

## 8. Arquivos envolvidos

- `artifacts/api-server/src/routes/scales.ts`
- `artifacts/api-server/src/routes/users.ts`
- `artifacts/api-server/src/services/coverage-engine.ts`
- `artifacts/api-server/src/services/scheduling-eligibility.ts`
- `artifacts/web-admin/src/pages/admin/scales.tsx`

## 9. Decisão solicitada

Ao aprovar este relatório, fica autorizada a seguinte sequência:

1. concluir as validações técnicas;
2. corrigir apenas erros diretamente relacionados a estas mudanças;
3. criar os dados mínimos de Equipes necessários para o teste;
4. testar os cenários funcionais no banco piloto;
5. apresentar o resultado dos testes antes da publicação;
6. somente após a confirmação final, enviar ao GitHub e publicar na Vercel.

Nenhuma publicação é autorizada apenas pela aprovação deste relatório sem a
apresentação do resultado dos testes.
