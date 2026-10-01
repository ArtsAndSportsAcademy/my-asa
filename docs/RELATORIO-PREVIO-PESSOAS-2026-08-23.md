# Relatório prévio de implementação — Pessoas e acessos

Data: 23 de agosto de 2026  
Estado: versão consolidada aguardando aprovação para implementação  
Escopo: Administração web, banco Piloto e integrações indispensáveis

## 1. Resultado recomendado

Implementar o módulo Pessoas aprovado no Figma sobre a fundação organizacional
existente, sem reconstruir a Escala e sem renomear agora a tabela `users` ou os
endpoints usados pelos demais módulos.

A separação entre Pessoa e conta de acesso será real no comportamento do
sistema, mesmo que os dados continuem fisicamente na mesma tabela nesta etapa:

- Pessoa existe sempre;
- login, senha, perfil de acesso e notificações são opcionais;
- Equipe e Operação base pertencem ao vínculo da Pessoa, não à permissão;
- arquivar a Pessoa não apaga o histórico;
- excluir só será permitido para cadastro comprovadamente incorreto e sem
  qualquer participação real.

Essa solução aproveita o que já está correto, reduz migração e evita quebrar
Escalas, Livros, Tarefas, Solicitações e autenticação.

## 2. Fontes aprovadas

- Decisões vigentes: `docs/DECISOES-APROVADAS.md`.
- Arquivo oficial do Figma:
  <https://www.figma.com/design/OH87C1uPdtd4ECLaqpZGwF>.
- Página do Figma: `07 — Pessoas` (`252:2`).
- Design aprovado: 26 telas administrativas, incluindo cadastro com e sem
  acesso, perfil, vínculos, histórico, edição, arquivamento, reativação,
  exclusão restrita, paginação, sucesso, vazio, busca sem resultado e erro.

## 3. O que já existe e será reaproveitado

### Banco de dados

A tabela `users` já possui a maior parte dos dados pessoais:

- nome completo e nome de uso;
- e-mail, telefone e foto;
- data de nascimento e entrada;
- função principal e especialização;
- situação da Pessoa (`ACTIVE`, `ON_LEAVE`, `LEFT`, `ARCHIVED`);
- situação do acesso (`ACTIVE`, `INACTIVE`);
- usuário, senha e obrigação de troca no primeiro acesso;
- observações administrativas;
- data e responsável pelo arquivamento.

`team_memberships` já preserva início, fim, situação e Equipe principal. A
Escala já começou a utilizar esses vínculos para descobrir quem pode ser
escalado, inclusive Pessoas sem login.

### API

Já existem operações para listar, criar, editar, ativar/desativar acesso e
excluir usuário. Também existe:

- geração de `nome.sobrenome` com tratamento de duplicidades;
- hash de senha com bcrypt;
- troca obrigatória da senha temporária;
- auditoria básica de criação, edição, situação e exclusão;
- proteção por organização e perfil autenticado.

### Interface atual

A página `artifacts/web-admin/src/pages/admin/users.tsx` já permite cadastrar e
editar dados básicos, criar ou não um acesso, atribuir papéis e excluir. Ela será
substituída pela experiência aprovada no Figma, preservando as chamadas que
continuarem corretas.

## 4. Lacunas encontradas

### Críticas

1. Alterar `personStatus` para `ARCHIVED` hoje não encerra automaticamente
   acesso, Equipes, papéis, responsabilidades, delegações ou participações
   futuras.
2. A exclusão atual depende principalmente das chaves estrangeiras. Ela ainda
   pode apagar alguém que já teve acesso ou Equipe, embora o Figma permita
   excluir somente um cadastro realmente incorreto e sem histórico.
3. `adminNotes` faz parte da resposta genérica de usuário. Supervisores podem
   receber esse campo em listagens, contrariando a privacidade aprovada.
4. Pessoa, Equipe e acesso são criados por ações separadas. Uma falha entre elas
   pode deixar um cadastro incompleto.

### Importantes

- Não existe endpoint próprio para reativar Pessoa.
- Não existe criação posterior de acesso com senha temporária gerada pelo
  servidor.
- Não existe redefinição administrativa de senha temporária.
- A Operação base não está registrada explicitamente no vínculo principal.
- O histórico do perfil não possui uma consulta própria e os eventos atuais têm
  poucos detalhes de antes/depois.
- A listagem carrega todos os usuários e filtra no navegador; não há paginação
  real nem contadores seguros no servidor.
- `photoUrl` existe, mas não há fluxo de upload persistente para Vercel.
- Campos privados e campos públicos ainda não possuem projeções distintas na
  API.

## 5. Arquitetura proposta

### 5.1 Manter compatibilidade

- Manter a tabela `users` nesta versão.
- Manter `/api/users` para não quebrar módulos existentes.
- Apresentar o conceito como **Pessoa** na interface e nos novos serviços.
- Criar uma camada `people-management.service.ts` para concentrar criação,
  acesso, arquivamento, reativação e elegibilidade de exclusão.
- Não usar `user_roles` como fonte de pertencimento à Equipe. Papéis continuarão
  representando acesso; `team_memberships` continuará representando vínculo.

### 5.2 Ajuste de dados

Adicionar `base_operation_id` a `team_memberships`. O campo será preenchido no
vínculo principal e validado contra as Operações cobertas pela Equipe. Assim,
Equipe principal e Operação base mudam juntas com histórico de início e fim,
sem criar uma lista geral de “participações habituais”.

Reutilizar `history_events` com:

- `category = PERSON`;
- `entityType = PERSON`;
- `entityId = id da Pessoa`;
- ação, responsável, data, estado anterior e estado posterior.

O histórico funcional ficará separado do log de segurança. O log de segurança
continuará registrando login, acesso, senha e permissões.

### 5.3 Projeções de privacidade

A API terá três formatos de resposta:

- **lista administrativa:** dados resumidos, Equipe, Operação base e situação do
  acesso;
- **detalhe administrativo:** inclui observações privadas e histórico;
- **perfil público/operacional:** nunca inclui observações administrativas,
  data de nascimento completa ou outros dados privados.

Somente administrador autorizado receberá e editará `adminNotes` nesta primeira
entrega.

## 6. Fluxos que serão implementados

### 6.1 Criar Pessoa

O botão final do fluxo executará uma transação única:

1. cria a Pessoa;
2. cria o vínculo com Equipe principal e Operação base;
3. cria o acesso somente se a opção estiver marcada;
4. gera usuário único;
5. gera senha temporária segura e a retorna uma única vez;
6. registra histórico e auditoria.

Se qualquer etapa obrigatória falhar, nenhuma delas será salva. A foto é
opcional: se o upload falhar, a Pessoa será criada com iniciais e a interface
permitirá tentar a foto novamente.

### 6.2 Criar ou editar acesso

Adicionar ações específicas:

- criar acesso posteriormente;
- ativar ou desativar acesso sem arquivar a Pessoa;
- alterar usuário com validação de duplicidade;
- alterar perfil de acesso;
- gerar nova senha temporária;
- obrigar troca no próximo login.

A senha temporária não será armazenada em texto aberto nem poderá ser consultada
depois; somente uma nova senha poderá ser gerada.

### 6.3 Alterar vínculo

Ao mudar Equipe principal ou Operação base:

- o vínculo anterior recebe `endsAt` e permanece no histórico;
- é criado um novo vínculo principal;
- a mudança não apaga participações passadas;
- a Pessoa continua podendo ser convocada por outras Operações.

### 6.4 Arquivar

O arquivamento será uma transação de ciclo de vida:

- marca a Pessoa como arquivada;
- desativa o acesso e encerra sessões;
- encerra vínculos ativos com Equipes;
- desativa papéis operacionais;
- encerra responsabilidades e delegações ativas;
- remove a Pessoa da elegibilidade de novas Escalas;
- preserva todo o histórico;
- identifica Escalas futuras já publicadas e marca as alocações como conflito,
  exigindo substituição e republicação;
- relaciona tarefas abertas e decisões pendentes para reassociação, sem apagar
  os registros.

A resposta apresentará um resumo do impacto para a administração.

### 6.5 Reativar

Reativar altera apenas a situação da Pessoa para ativa. Por segurança:

- acesso anterior não volta automaticamente;
- Equipe e Operação base não voltam automaticamente;
- responsabilidades e delegações não voltam automaticamente;
- a tela orienta a administração a redefinir os vínculos necessários.

### 6.6 Excluir cadastro incorreto

Antes de mostrar ou executar a exclusão, o servidor verificará se a Pessoa:

- nunca teve senha, login ativo ou sessão;
- nunca teve papel ou vínculo com Equipe;
- nunca esteve em Escala, Livro, tarefa, solicitação ou comunicação;
- nunca teve responsabilidade ou delegação;
- não possui histórico operacional.

Somente se todos os itens forem falsos o botão de exclusão ficará disponível.
Caso contrário, a API retorna bloqueio e orienta o arquivamento.

## 7. Interface administrativa

A página atual será dividida em componentes menores, mantendo a rota
`/admin/users` por compatibilidade:

- cabeçalho e abas Ativas/Arquivadas;
- busca, filtros, paginação e contadores vindos da API;
- mapa de Pessoas;
- fluxo de criação em três etapas e revisão;
- perfil com Visão geral, Vínculos e Histórico;
- edição separada de Dados pessoais, Vínculo ASA e Acesso;
- modais de arquivar, reativar e excluir cadastro incorreto;
- feedbacks temporários que não removem o botão permanente “Nova pessoa”;
- estados vazio, busca sem resultado, carregamento e erro;
- ASA contextual, usando os assets existentes sem cortes.

O item da navegação será alterado de **Usuários** para **Pessoas e acessos**.

## 8. Upload de foto

Recomendação: criar um bucket `profile-photos` no Supabase Storage do ambiente
Piloto.

- formatos aceitos: JPEG, PNG e WebP;
- limite inicial: 5 MB;
- nome interno gerado pelo servidor;
- validação de tipo real do arquivo;
- substituição remove ou agenda limpeza da foto anterior;
- a aplicação guarda apenas a URL/chave no campo `photoUrl`;
- Produção terá bucket e credenciais próprios.

Nenhuma chave de serviço será exposta no navegador.

## 9. Arquivos previstos

### Banco e contrato

- nova migração em `lib/db/drizzle/`;
- `lib/db/src/schema/teams.ts`;
- `lib/db/src/schema/audit.ts` e/ou uso ampliado de `history.ts`;
- `lib/api-spec/openapi.yaml`;
- clientes gerados em `lib/api-zod` e `lib/api-client-react`.

### API

- `artifacts/api-server/src/routes/users.ts`;
- novo `artifacts/api-server/src/services/people-management.service.ts`;
- ajustes em `groups.ts` para permitir vínculo de Pessoa sem login;
- integração pontual com Escalas, responsabilidades, delegações e sessões;
- testes em `artifacts/api-server/tests/people-lifecycle.test.ts`.

### Web

- `artifacts/web-admin/src/pages/admin/users.tsx` ou pasta modular equivalente;
- componentes específicos em `artifacts/web-admin/src/components/people/`;
- `artifacts/web-admin/src/components/admin-layout.tsx`;
- hooks manuais somente quando o gerador não cobrir a operação.

## 10. Ordem segura de implementação

### Pré-requisito

Há alterações anteriores da Escala ainda sem commit e `users.ts` já foi tocado
por elas. Antes de iniciar Pessoas, essas mudanças devem ser preservadas e
fechadas em seu próprio commit. Não será feito reset nem descarte do trabalho.

### Onda 1 — Contrato e ciclo de vida

1. criar branch `codex/pessoas-admin` a partir de uma base limpa;
2. adicionar migração e serviço de domínio;
3. criar consultas resumida, detalhada e histórica;
4. implementar criação atômica, acesso, arquivamento, reativação e exclusão
   protegida;
5. atualizar OpenAPI e clientes;
6. executar testes da API.

### Onda 2 — Interface aprovada

1. construir lista e estados;
2. construir cadastro com e sem acesso;
3. construir perfil e edição por abas;
4. construir modais e feedbacks;
5. validar visualmente contra o Figma;
6. executar typecheck e build.

### Onda 3 — Piloto

1. aplicar migração somente no banco Piloto;
2. criar bucket de fotos do Piloto;
3. publicar Preview;
4. testar com a conta Administrador/Babi;
5. corrigir falhas encontradas;
6. solicitar aceite antes de qualquer Produção.

## 11. Testes obrigatórios

### API e banco

- criar Pessoa sem login e com vínculo principal;
- criar Pessoa com login, usuário duplicado e senha temporária;
- criar acesso depois do cadastro;
- impedir leitura de observação privada por supervisor e membro;
- mudar Equipe/Operação preservando o vínculo anterior;
- arquivar e encerrar acesso, sessões, vínculos e elegibilidade;
- gerar conflito em Escala futura publicada;
- reativar sem restaurar automaticamente acesso e vínculos;
- excluir cadastro vazio;
- bloquear exclusão após qualquer acesso, vínculo ou histórico;
- impedir acesso entre organizações;
- manter Pessoa sem login disponível para Escala quando escalável;
- manter administrador, professor e treinador fora da Escala conforme as regras
  vigentes.

### Interface

- paginação, busca, filtros e contadores;
- todos os estados do Figma;
- carregamento e erro sem perda do formulário;
- foto opcional com fallback de iniciais;
- senha temporária mostrada uma única vez;
- navegação por teclado, foco dos modais e contraste;
- resoluções desktop aprovadas no Figma.

### Regressão

- autenticação;
- Equipes;
- Escalas e cobertura;
- Folgas;
- Responsabilidades e delegações;
- tarefas e solicitações abertas.

## 12. Validação técnica

Antes do Preview:

- `pnpm --filter @workspace/api-server typecheck`;
- `pnpm --filter @workspace/web-admin typecheck`;
- geração dos contratos OpenAPI;
- suíte `people-lifecycle.test.ts`;
- testes existentes de Operações, Escala e Livro do Dia;
- `git diff --check`;
- build local completo.

O bloqueio anterior de `@esbuild/win32-x64` precisa estar resolvido. Typecheck
sozinho não será tratado como prova de funcionamento.

## 13. Riscos e proteções

| Risco | Proteção |
|---|---|
| Arquivar quebrar Escalas já publicadas | marcar conflito, preservar alocação e exigir republicação |
| Pessoa sem login desaparecer da Escala | elegibilidade baseada em vínculo e função, não em conta |
| Dados privados vazarem | projeções distintas e teste de autorização |
| Criação ficar pela metade | transação única |
| Exclusão apagar histórico | verificação explícita de elegibilidade no servidor |
| Nova tela quebrar outros módulos | manter tabela, rota e tipos compatíveis durante a transição |
| Foto falhar em Vercel | armazenamento persistente externo e fallback de iniciais |
| Misturar mudanças da Escala e Pessoas | commits e branch separados |

## 14. Fora desta implementação

- redesenho completo de todos os perfis de acesso da ASA;
- telas mobile de Pessoas;
- revisão visual dos módulos Equipes, Responsabilidades e Delegações;
- importação em massa de Pessoas;
- capacidades/habilidades gerais;
- publicação em Produção.

Esses itens podem ser integrados depois sem alterar o núcleo proposto.

## 15. Complementos da auditoria final

### 15.1 Ciclo de vida da Pessoa

As situações terão efeitos explícitos e não serão tratadas apenas como etiquetas:

| Situação | Onde aparece | Acesso | Equipe e Escala |
|---|---|---|---|
| `ACTIVE` | aba Ativas | permanece conforme configurado | elegível quando vínculo e função permitirem |
| `ON_LEAVE` | aba Ativas, com destaque de afastamento | não é desativado automaticamente | fica inelegível durante o período; alocações futuras geram conflito |
| `LEFT` | aba Arquivadas, com identificação de desligamento | é desativado e as sessões são encerradas | vínculos ativos são encerrados e o histórico é preservado |
| `ARCHIVED` | aba Arquivadas | é desativado e as sessões são encerradas | vínculos ativos são encerrados e o histórico é preservado |

O afastamento terá início obrigatório e fim opcional. Encerrar o afastamento
devolve a Pessoa à situação ativa, mas não resolve automaticamente conflitos
criados em Escalas publicadas. Reativar uma Pessoa desligada ou arquivada não
restaura acesso, vínculos, papéis, responsabilidades ou delegações.

### 15.2 Matriz de permissões da primeira entrega

| Ação | Administrador autorizado | Direção | Supervisor | Própria Pessoa |
|---|---:|---:|---:|---:|
| Listar e consultar todas as Pessoas | sim | sim | somente no alcance de suas responsabilidades | não |
| Ver observações administrativas | sim | não | não nesta primeira entrega | não |
| Criar, editar dados administrativos e arquivar | sim | não | não | não |
| Criar acesso, alterar perfil e redefinir senha | sim | não | não | não |
| Ver perfil operacional | sim | sim | dentro do seu alcance | próprio perfil |
| Alterar foto, nome de uso, telefone, e-mail e senha | sim | não | não | somente os próprios dados |

O Administrador do Piloto representa a responsabilidade operacional atualmente
exercida por Babi. Ter perfil de Direção ou Supervisor não concede, sozinho,
permissão para administrar cadastros. Futuras permissões granulares poderão ser
delegadas sem ampliar automaticamente o perfil inteiro.

### 15.3 Equipe principal, colaboração e convocação

- cada Pessoa terá no máximo um vínculo principal ativo;
- colaborações estáveis com outras Equipes poderão ser registradas como vínculos
  secundários, sem trocar a Equipe principal;
- uma convocação pontual para outra Equipe ou Operação não criará vínculo
  secundário permanente;
- todos os vínculos terão início, fim, responsável pela alteração e histórico;
- somente o vínculo principal exigirá Operação base;
- a existência de vínculo secundário não concede permissão de acesso por si só.

### 15.4 Perfil editável pela própria Pessoa

A entrega incluirá um fluxo mínimo de perfil próprio para os campos já
aprovados: foto, nome de uso, telefone, e-mail e senha. Nome civil, função,
Equipe, Operação base, situação, data de entrada e observações administrativas
continuarão sob gestão autorizada.

Essa edição usará endpoint e projeção próprios. Ela não reutilizará o formulário
administrativo completo nem enviará campos privados ao navegador do membro.

### 15.5 Migração, backup e reversão do Piloto

Antes da migração:

1. gerar backup recuperável do banco Piloto;
2. contar e auditar Pessoas, contas, papéis e vínculos existentes;
3. identificar vínculos principais ausentes ou duplicados;
4. preparar a correspondência de Equipe e Operação base sem inventar dados;
5. registrar os casos que precisarem de decisão manual.

A migração será idempotente e aplicada primeiro em uma cópia ou ambiente de
Preview. Depois serão comparados os totais anteriores e posteriores. A reversão
será documentada e testada antes de aplicar a mudança ao Piloto utilizado pelas
pessoas. Nenhuma migração será aplicada diretamente em Produção.

### 15.6 Prevenção de cadastros duplicados

Durante a criação, o servidor procurará correspondências por e-mail, telefone e
combinação de nome com data de nascimento. A interface mostrará um alerta com
possíveis Pessoas existentes e permitirá abrir o perfil correspondente.

O alerta não bloqueará automaticamente homônimos. E-mail de acesso e nome de
usuário continuarão únicos quando existirem. A decisão de prosseguir será
registrada na auditoria quando houver possível duplicidade.

### 15.7 Matriz de impacto do ciclo de vida

Antes de afastar, desligar ou arquivar, o serviço consultará e apresentará o
impacto em:

- Escalas em rascunho e publicadas;
- Livros do Dia e Livros de Show futuros;
- tarefas e solicitações abertas;
- check-ins e ocorrências pendentes;
- responsabilidades e delegações;
- compromissos ou participações futuras;
- conversas, avisos e registros históricos relacionados.

Os registros históricos nunca serão apagados. Itens futuros que exigirem outra
pessoa serão marcados para revisão ou reassociação; itens passados permanecerão
associados à Pessoa original.

### 15.8 Rastreabilidade entre Figma, regra e teste

Antes de construir a interface será criada uma matriz de aceite das 26 telas da
página `07 — Pessoas`. Para cada tela, ela registrará:

- node do Figma e nome do estado;
- regra de negócio atendida;
- endpoint e projeção utilizados;
- perfil autorizado;
- teste automatizado e cenário de validação visual;
- situação: pendente, implementado, validado ou aprovado.

Uma tela visualmente pronta não será considerada concluída se a regra, a
autorização ou o teste correspondente estiverem ausentes.

### 15.9 Fotos, retenção e privacidade

- fotos serão visíveis apenas a usuários autenticados que possam consultar o
  perfil operacional da Pessoa;
- o bucket não permitirá listagem pública dos arquivos;
- a aplicação entregará URLs assinadas ou uma rota protegida, conforme a
  capacidade confirmada do ambiente;
- substituir a foto colocará o arquivo anterior em uma fila de limpeza;
- arquivar preservará a referência necessária ao histórico;
- excluir um cadastro incorreto removerá também sua foto sem uso;
- tipo, tamanho e conteúdo básico do arquivo serão validados no servidor.

### 15.10 Notificações sem excesso

Serão notificáveis somente eventos que exigem conhecimento ou ação:

- acesso criado ou redefinido;
- alteração administrativa relevante no próprio perfil;
- mudança de Equipe ou Operação base;
- afastamento, retorno, desligamento ou arquivamento;
- conflito em atividade futura provocado pela mudança de situação.

Eventos administrativos em lote serão agrupados. O mesmo evento não enviará
avisos repetidos por diferentes módulos, e atualizações sem consequência para o
usuário permanecerão apenas no histórico e na auditoria.

## 16. Aprovação solicitada

Ao aprovar este relatório, fica autorizado somente:

- implementar Administração web do módulo Pessoas;
- aplicar mudanças no ambiente local e no banco Piloto;
- criar o armazenamento de fotos do Piloto;
- gerar um Preview para testes.

Produção continuará bloqueada até relatório pós-implementação, testes e novo
aceite da responsável do produto.
