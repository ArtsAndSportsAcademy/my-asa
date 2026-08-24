# Auditoria transversal — Perfis, acessos e visibilidade do My ASA

Data: 23 de agosto de 2026  
Estado: direção aprovada em 23 de agosto de 2026; correções ainda não implementadas  
Escopo: regras aprovadas, Figma oficial, aplicação web, API, banco e testes

## 1. Veredito executivo

O My ASA ainda não está seguro nem coerente para liberar todos os perfis no
Piloto. A fundação contém boas decisões, mas perfil profissional, perfil de
acesso, Operação e delegação ainda se misturam em alguns pontos do código.

O desenho mais simples e compatível com as decisões aprovadas é manter somente
quatro perfis de acesso do produto:

1. **Administração autorizada** — atualmente Babi e a conta Administrador do
   Piloto;
2. **Direção** — visão organizacional ampla, prioritariamente somente leitura;
3. **Supervisão** — autoridade limitada pelas responsabilidades, Equipes,
   atividades e Operações sob seu alcance;
4. **Membro** — acesso pessoal e ao conteúdo publicado relacionado à sua
   participação.

Treinador, professor, fisioterapeuta, convidado, produção, figurino, patinador e
bailarino não devem ser perfis de acesso independentes. São funções,
especializações, Equipes ou condições de participação. Quando precisarem de
login, recebem o acesso mínimo adequado ao seu contexto, sem ganhar autoridade
administrativa.

Capitão, responsável temporário e delegado também não são perfis de acesso.
São responsabilidades contextuais e auditáveis; a delegação pode ser permanente
até revogação ou possuir um período determinado.

## 2. Fontes verificadas

- decisões vigentes em `docs/DECISOES-APROVADAS.md`;
- relatório consolidado de Pessoas e acessos;
- documentos de jornadas, governança e pesquisas de Admin, Supervisor e Membro;
- Figma oficial `OH87C1uPdtd4ECLaqpZGwF`;
- Operações — Administração (`27:3`), Supervisão (`27:5`) e Minha visão
  (`27:6`);
- Pessoas — Administração, página `07 — Pessoas` (`252:2`);
- esquema de identidade, papéis, autenticação, rotas, navegação e testes do
  repositório atual.

Documentos históricos que tratam Admin, Supervisor e Membro como os únicos
atores foram usados como referência de jornada, não como autorização para
ignorar as decisões posteriores sobre Direção e profissionais especiais.

## 3. Separação conceitual obrigatória

| Camada | Pergunta respondida | Exemplos |
|---|---|---|
| Pessoa | Quem é? | Carolina, Victor, Babi |
| Função/especialização | O que faz profissionalmente? | patinadora, professor, fisioterapeuta |
| Equipe | Onde pertence organizacionalmente? | Patinação, Bailarinos, Produção, Gestão |
| Operação | Em qual contexto o trabalho acontece? | Snowland, Acquamotion, Hotelaria |
| Perfil de acesso | Qual nível básico de acesso possui? | Administração, Direção, Supervisão, Membro |
| Responsabilidade | Sobre o que pode decidir? | Escalas, show, Equipe, check-ins |
| Delegação | Qual autoridade recebeu temporariamente? | publicar Escala durante ausência |
| Convocação | De qual atividade participa naquele contexto? | Musical de amanhã, pocket de hotelaria |

Nenhuma dessas camadas deve conceder automaticamente todas as outras. Ser
Supervisor da ASA, por exemplo, não significa administrar Pessoas; ser membro
da Equipe Gestão não significa possuir acesso administrativo; participar de uma
Operação não significa supervisioná-la.

## 4. Matriz recomendada dos perfis de acesso

| Superfície | Administração autorizada | Direção | Supervisão | Membro |
|---|---|---|---|---|
| Início / Meu Dia | visão de gestão | visão executiva | visão operacional do escopo | visão pessoal |
| Operações | cria, configura, arquiva | consulta geral | consulta e decide no escopo | conteúdo publicado da participação |
| Pessoas e acessos | administra | consulta operacional | consulta no alcance | próprio perfil |
| Equipes | administra estrutura | consulta geral | consulta e opera no alcance | própria Equipe |
| Escalas | autoridade global configurada | consulta geral | cria/publica no escopo ou delegação | própria Escala e grade publicada permitida |
| Livro do Show | estrutura e configuração | consulta | configuração autorizada do show | somente recorte publicado quando convocado |
| Livro do Dia | consulta e contingência | consulta | gera, revisa e publica no escopo | recorte publicado da participação |
| Agenda | cria e administra | consulta geral | cria no escopo | compromissos visíveis ou relacionados |
| Check-in e ocorrências | visão geral | resumo permitido | acompanha sua Equipe | registra o próprio estado |
| Folgas e solicitações | governa e escala decisões | indicadores/resumo | decide no alcance | cria e acompanha as próprias |
| Tarefas | visão e gestão ampla | consulta permitida | cria e acompanha no alcance | executa as próprias |
| Avisos e mensagens | escopo organizacional | comunicação institucional | comunicação do escopo | recebe e participa quando permitido |
| Biblioteca | administra | consulta geral | publica no alcance autorizado | consulta conteúdo liberado |
| Indicadores e histórico | completo | executivo | escopo operacional | somente histórico pessoal necessário |
| Auditoria de segurança | completo | não | não | não |
| ASA IA | governança e diagnóstico | resumo executivo | copiloto operacional | assistente pessoal |

Esta matriz é a base. Uma responsabilidade ou delegação pode ampliar uma ação
específica, mas nunca transforma toda a pessoa em outro perfil.

## 5. Mapeamento atual do código

O banco possui os papéis técnicos `ADMIN`, `SUPERVISOR_A`, `SUPERVISOR_B`,
`MEMBER` e `TRAINER`.

| Código atual | Interface atual | Diagnóstico |
|---|---|---|
| `ADMIN` | “Gerência” | mistura conta técnica, administração autorizada e gestão |
| `SUPERVISOR_A/B` | “Supervisor” | dois códigos com quase as mesmas permissões e sem significado atual aprovado |
| `MEMBER` | “Elenco” | nome restritivo; nem todo Membro com login é elenco |
| `TRAINER` | “Treinador” | duplica a especialização profissional e é tratado de forma inconsistente |
| delegação ativa | “Capitão” | direção correta, mas a cobertura de rotas é parcial |
| Direção | inexistente | Cris não possui um perfil de somente leitura correspondente às regras |

## 6. Achados críticos — prioridade P0

### P0-01 — Conta sem papel ativo vira Membro

`getPrimaryRole` retorna `MEMBER` quando não encontra nenhum papel reconhecido.
Assim, remover todos os papéis não encerra o acesso: uma conta ativa pode
receber token de Membro. A regra correta é negar login ou contexto operacional
quando não existe perfil ativo.

### P0-02 — `TRAINER` existe no banco, mas não existe na prioridade do token

Uma conta apenas com `TRAINER` recebe `role = MEMBER` no token. Ao mesmo tempo,
a interface lê a lista completa de papéis e tenta tratá-la como Treinador. API e
web podem, portanto, tomar decisões diferentes para a mesma pessoa.

### P0-03 — Papel principal global pode ampliar autoridade entre Operações

O token contém um único papel principal e agrega todas as Operações de todos os
papéis. Uma pessoa Supervisora na Operação A e Membro na Operação B pode chegar
a rotas com `role = SUPERVISOR` e `operationIds = [A, B]`. Algumas áreas já
reconsultam o banco corretamente, mas outras confiam apenas no token. Pertencer
à Operação B não pode provar autoridade de Supervisão nela.

### P0-04 — Rotas administrativas da web aceitam qualquer não-Treinador

`TrainerBlockedRoute` protege Livro do Show, Agenda, Meu Dia administrativo,
Responsabilidades e ASA apenas contra `TRAINER`. Um `MEMBER` autenticado pode
abrir essas páginas. Mesmo quando a API bloqueia uma mutação, a tela incorreta e
eventuais consultas de leitura continuam sendo risco de visibilidade.

### P0-05 — Equipes podem atravessar organizações em respostas de contexto

`/organizations/current` consulta todos os grupos sem filtro antes de responder.
`getUserContext` também consulta todos os grupos e entrega o conjunto completo
para Administração. Isso pode expor estrutura de outra organização.

### P0-06 — Dados privados de Pessoas usam uma projeção genérica

`safeUser` remove somente `passwordHash`. Observações administrativas, data de
nascimento, contato, situação e campos internos continuam na resposta. A lista
de Supervisão e o perfil próprio podem receber informações que não deveriam
ver. O Figma também diz “gestão e supervisores autorizados”, enquanto o relatório
aprovado de Pessoas limita `adminNotes` à Administração na primeira entrega.

### P0-07 — Arquivar a Pessoa não bloqueia necessariamente o login

A autenticação verifica `users.status`, mas não `personStatus`. Como o fluxo
atual não executa a desativação completa ao marcar `ARCHIVED` ou `LEFT`, uma
Pessoa arquivada pode continuar com acesso ativo até outra ação separada.

### P0-08 — Expiração de Convidado depende de alguém listar Pessoas

A data `visitUntil` é verificada durante `GET /users`, não no login nem em um
processo confiável de expiração. Um Convidado pode continuar entrando depois da
data final se ninguém abrir a listagem que executa a desativação tardia.

## 7. Achados importantes — prioridade P1

### P1-01 — Direção não existe no modelo técnico

O Figma e as regras dizem que Direção utiliza a visão administrativa em modo
somente leitura, mas não há papel, política, navegação nem testes para esse
comportamento.

### P1-02 — Administração e Gestão estão confundidas

A interface chama todo `ADMIN` de “Gerência”. Nem toda pessoa da Equipe Gestão
deve administrar cadastros, e a conta Administrador do Piloto não deve ser
tratada como uma pessoa do elenco ou da Equipe Gestão.

### P1-03 — `SUPERVISOR_A` e `SUPERVISOR_B` perderam significado de produto

Quase todas as rotas concedem as mesmas ações a ambos. Autoridade real depende
de Equipe, show, atividade, Operação, responsabilidade e delegação. Manter A/B
como se fossem níveis globais aumenta complexidade sem representar o trabalho
explicado pela ASA.

### P1-04 — Não existe troca clara de contexto por Operação e papel efetivo

A navegação escolhe o papel de maior prioridade e o aplica globalmente. Uma
pessoa que supervisiona Snowland e participa como Membro em Hotelaria não possui
uma forma clara de visualizar cada contexto com a autoridade correta.

### P1-05 — Professor e outros profissionais especiais herdam experiência errada

Professor é especialização, não papel. Se possuir acesso de Membro, recebe a
navegação de “Elenco”, com Folgas, Tarefas e Livros que podem não corresponder ao
seu contexto. Treinador recebe uma navegação própria, embora seja igualmente uma
especialização profissional. O tratamento não é uniforme.

### P1-06 — Delegação é parcial na interface

A navegação reconhece somente um conjunto fixo de responsabilidades. A política
não está centralizada para todas as rotas e ações. Delegação deve autorizar a
ação concreta no servidor, dentro do seu escopo e de sua vigência — permanente
até revogação ou temporária —, e não apenas liberar uma página no navegador.

### P1-07 — Vínculo de Equipe ainda depende de papel em fluxos legados

A fundação nova separa `team_memberships` de `user_roles`, porém algumas consultas
e mutações ainda usam papéis para localizar membros ou impor pertencimento.
Pessoa sem login precisa continuar pertencendo à Equipe e podendo ser escalável
quando elegível.

## 8. Cobertura das interfaces no Figma

### Operações

- Administração possui fluxo amplo e estados administrativos;
- Supervisão possui uma visão operacional coerente com decisões pendentes e
  ações dentro do escopo;
- Minha visão protege rascunhos, dados privados e Livros sem participação;
- Direção é mencionada como somente leitura, mas não possui estado próprio nem
  anotação completa de ações indisponíveis;
- treinador, professor e convidado podem reutilizar Minha visão, filtrada pelo
  conteúdo relacionado, sem exigir novos perfis visuais.

### Pessoas e acessos

- a página `07 — Pessoas` possui o fluxo administrativo detalhado;
- ainda não existe tela de consulta de Direção;
- ainda não existe consulta restrita de Supervisor;
- ainda não existe o perfil próprio mínimo para alteração de foto, nome de uso,
  telefone, e-mail e senha;
- a cópia da observação administrativa conflita com a restrição mais segura da
  primeira entrega;
- não há estados específicos que demonstrem como um profissional especial ou
  Convidado com acesso enxerga seu próprio perfil.

### Conclusão visual

O Figma administrativo de Pessoas pode continuar como base, mas a matriz de
perfis ainda não está visualmente fechada. Não é necessário duplicar todas as 26
telas para todos os perfis. São necessárias somente as superfícies realmente
diferentes: consulta de Direção, consulta de Supervisão e perfil próprio.

## 9. Situação por perfil e contexto

| Perfil/contexto | Regras | Figma | Código | Veredito |
|---|---|---|---|---|
| Administração autorizada | definida | ampla | parcial | não liberar antes dos P0 |
| Direção | definida como leitura | incompleta | ausente | bloqueado |
| Supervisão | definida por escopo | parcial | ampla, mas inconsistente | bloqueado até corrigir escopo |
| Membro | definida como pessoal/publicada | parcial | várias telas existentes | bloqueado até corrigir rotas e projeções |
| Treinador/Professor | função especial, não autoridade | incompleta | tratamento divergente | precisa unificação |
| Convidado | temporário, opcionalmente escalável | incompleta | expiração insegura | bloqueado até corrigir ciclo de vida |
| Capitão/Delegado | responsabilidade temporária | parcial | parcial | testar ação por ação |
| Pessoa sem login | permitida | contemplada no Admin | fundação parcial | preservar e concluir |

## 10. Arquitetura de autorização recomendada

### 10.1 Perfil simples, escopo explícito

Usar como perfis efetivos:

- `ADMIN` — Administração autorizada;
- `DIRECTION` — leitura organizacional ampla;
- `SUPERVISOR` — operação dentro do escopo;
- `MEMBER` — acesso pessoal.

Durante a migração, `SUPERVISOR_A/B` podem ser aceitos como aliases de
`SUPERVISOR`. `TRAINER` deve deixar de ser autoridade e permanecer como
especialização, com acesso básico definido separadamente.

### 10.2 Nunca inferir Membro por ausência

Uma conta ativa sem perfil efetivo deve receber bloqueio de configuração, não
um token de Membro. Pessoa sem conta continua válida; conta sem perfil não.

### 10.3 Política central no servidor

Criar um resolvedor único com a forma:

`autorizar(pessoa, ação, recurso, operação, equipe, contexto)`

Ele deve combinar:

- perfil de acesso ativo;
- escopo comprovado no banco;
- responsabilidade ativa;
- delegação ativa e válida, respeitando a expiração quando for temporária;
- situação da Pessoa e da conta;
- estado do recurso, como rascunho ou publicado.

O navegador usa a mesma política para orientar a interface, mas nunca é a fonte
final da autorização.

### 10.4 Contexto efetivo por Operação

O seletor de Operação deve calcular a autoridade daquela pessoa no contexto
selecionado. A pessoa pode ser Supervisora em Snowland e Membro em Hotelaria sem
receber Supervisão global. A visão consolidada pessoal pode reunir suas
participações sem ampliar poder de decisão.

### 10.5 Projeções de dados

Criar respostas distintas para:

- administração de Pessoas;
- consulta executiva da Direção;
- consulta operacional de Supervisão;
- perfil próprio;
- cartão público mínimo dentro de atividade, Equipe ou conversa.

Dados privados não devem ser enviados e escondidos apenas por CSS.

## 11. Ordem segura de correção

### Onda 0 — Provas antes da mudança

1. preservar as alterações atuais da Escala em commit próprio;
2. criar testes de autorização que reproduzam todos os P0;
3. registrar a matriz atual de rotas e respostas;
4. preparar migração reversível dos papéis.

### Onda 1 — Fechamento de segurança

1. negar conta sem perfil;
2. aplicar situação e validade do Convidado no login e refresh;
3. corrigir isolamento por organização;
4. substituir as rotas visuais permissivas por política explícita;
5. criar projeções seguras de Pessoa;
6. impedir autoridade cruzada entre Operações.

### Onda 2 — Modelo de perfis

1. adicionar Direção;
2. unificar Supervisão no conceito de produto;
3. migrar Treinador para especialização + acesso básico;
4. manter Convidado como condição temporária;
5. centralizar responsabilidade e delegação.

### Onda 3 — Experiência por perfil

1. ajustar início e navegação por perfil efetivo;
2. criar consulta de Direção;
3. criar consulta de Supervisão;
4. criar perfil próprio;
5. permitir mudança segura de contexto por Operação;
6. alinhar as cópias e estados do Figma.

### Onda 4 — Piloto controlado

Testar com contas separadas, nunca apenas alterando o papel da mesma sessão:

- Administrador do Piloto/Babi;
- Cris em Direção;
- Victor como Supervisor de Snowland;
- Supervisor de outra Operação;
- Carolina como Membro;
- pessoa Supervisora em uma Operação e Membro em outra;
- Treinador;
- Professor;
- Convidado ativo e Convidado expirado;
- Capitão com delegação permanente, temporária válida, expirada e revogada;
- Pessoa sem login;
- conta ativa sem perfil, que deverá ser bloqueada.

## 12. Testes obrigatórios

### Autorização

- matriz `perfil × Operação × ação × estado do recurso`;
- negação por padrão para combinação não prevista;
- isolamento entre organizações;
- papel diferente em duas Operações;
- responsabilidade e delegação dentro e fora do prazo;
- sessão já emitida após arquivamento, desligamento ou revogação;
- rascunho versus publicado.

### Privacidade

- nenhum perfil não autorizado recebe `adminNotes`;
- Direção recebe apenas a projeção executiva aprovada;
- Supervisão recebe somente Pessoas dentro do alcance;
- Membro recebe somente dados próprios e cartões mínimos de terceiros;
- busca e contadores não revelam registros fora do alcance.

### Navegação

- URL digitada manualmente é negada como a navegação oculta;
- a página inicial correta abre para cada perfil;
- troca de Operação recalcula autoridade e menu;
- delegação inclui somente as ações recebidas;
- Treinador, Professor e Convidado não recebem menus administrativos.

### Regressão operacional

- Escala e Livro do Dia preservam a autoridade já corrigida por Operação;
- Convidado ativo continua escalável quando convocado;
- Professor e Treinador continuam fora do elenco escalável;
- Pessoa sem login permanece disponível à Escala quando elegível;
- desligar ou arquivar gera conflitos futuros sem apagar o passado.

Hoje existem testes úteis de Operações e partes do Livro do Dia, mas não existe
uma suíte transversal de perfis suficiente para esta matriz.

## 13. Impacto sobre o relatório de Pessoas

O relatório `RELATORIO-PREVIO-PESSOAS-2026-08-23.md` continua válido para o
fluxo administrativo, porém sua implementação deve depender da Onda 1 desta
auditoria. Em especial:

- as projeções privadas precisam existir antes da nova tela;
- Direção, Supervisão e perfil próprio precisam de contratos separados;
- arquivamento, desligamento e validade de Convidado precisam afetar autenticação;
- a matriz das 26 telas deve incluir também os três estados adicionais de
  consulta, sem duplicar o fluxo administrativo completo.

## 14. Decisões solicitadas antes da implementação

Aprovar esta direção significa aceitar que:

1. o MVP terá quatro perfis de acesso: Administração, Direção, Supervisão e
   Membro;
2. treinador, professor, convidado e demais profissões serão funções ou
   especializações, não autoridades globais;
3. Capitão e Delegado serão responsabilidades contextuais, não perfis; a
   delegação poderá ser permanente ou temporária;
4. `SUPERVISOR_A/B` serão tratados como legado a migrar;
5. nenhuma tela de Pessoas será integrada antes de fechar os problemas P0;
6. Produção continuará bloqueada até testes por conta e por Operação.

Direção aprovada pela responsável do produto em 23 de agosto de 2026. Esta
aprovação não autoriza mudanças em Produção e ainda não altera o código atual.
