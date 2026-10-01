# My ASA — Especificação Mestre de Produto

**Versão:** 0.9 — candidata à validação  
**Atualização:** 24 de agosto de 2026  
**Escopo:** funcionamento do produto, sem especificação técnica ou autorização de construção

## 1. Como usar este documento

Este documento reúne em uma única visão o funcionamento esperado do My ASA. Ele existe para orientar as próximas conversas de produto, o Figma e, somente depois de aprovação, a implementação.

As definições usam três estados:

- **Consolidado:** regra já explicada e aprovada pela responsável do produto.
- **Proposta para validação:** recomendação criada para fechar uma lacuna sem assumir que ela já foi aprovada.
- **Futuro:** ideia válida, mas fora do núcleo da primeira versão.

Quando este documento divergir de materiais antigos, a divergência deverá ser apresentada para decisão. Nenhuma proposta deste arquivo autoriza automaticamente mudança no Figma, no código ou em ambientes publicados.

## 2. Visão do produto

O My ASA é a plataforma de gestão operacional da Arts and Sports Academy. Seu objetivo é reunir, organizar e tornar executável aquilo que hoje fica espalhado entre planilhas, grupos de WhatsApp, calendários, documentos e decisões verbais.

A plataforma deve ajudar cada pessoa a responder, sem procurar em vários lugares:

- o que acontece hoje;
- onde precisa estar;
- qual atividade realizará;
- com quem realizará;
- qual papel ou posição assumirá;
- o que mudou desde a última publicação;
- quem pode decidir cada assunto;
- quais pendências precisam de ação.

Para supervisores e gestão, o produto deve diminuir o tempo gasto montando Escalas, conciliando folgas, corrigindo conflitos, adaptando Livros e avisando pessoas individualmente.

## 3. Problema principal

Hoje, a preparação operacional depende de conversas e conferências manuais. Informações recorrentes são redigitadas, pessoas em folga podem ser convocadas por engano, mudanças no Livro podem não chegar à Escala e correções urgentes podem se perder no WhatsApp.

O My ASA resolve esse problema ao conectar uma cadeia única de planejamento e execução:

```text
Pessoas e Equipes
        ↓
Operações, Shows e Atividades
        ↓
Programação da Operação
        ↓
Livros oficiais + Folgas + Indisponibilidades
        ↓
Livro do Dia + Escala do Dia
        ↓
Revisão e publicação
        ↓
Meu Dia + alertas + acompanhamento operacional
```

## 4. Princípios do My ASA

1. **A Escala é o coração do produto.** Os demais módulos devem alimentar, explicar ou acompanhar a operação, sem duplicar a mesma verdade.
2. **A ASA é uma só.** Operações organizam os contextos de trabalho; não fragmentam as pessoas em empresas independentes.
3. **A pessoa vê sua realidade consolidada.** Quem participa de mais de uma Operação deve enxergar todas as próprias convocações em uma visão única.
4. **Autoridade é contextual.** Ser supervisor não significa decidir tudo. A responsabilidade indica em qual Equipe, atividade, show ou Operação a pessoa pode agir.
5. **Recorrência não deve gerar trabalho repetitivo.** O sistema deve reutilizar programação, regras, rodízios e Livros oficiais.
6. **Exceções exigem atenção humana.** A automação propõe; a pessoa responsável revisa e publica.
7. **Publicação é um compromisso operacional.** Mudanças posteriores geram nova versão, histórico e comunicação dirigida.
8. **Informação sensível aparece somente para quem precisa.** O elenco recebe o necessário para trabalhar, não a visão administrativa completa.
9. **Arquivar preserva a história.** Pessoas, Equipes e Operações não desaparecem dos registros passados.
10. **O produto precisa funcionar em dias caóticos.** A experiência deve ser simples, direta e utilizável no celular.
11. **A mascote ASA acolhe e orienta.** Ela deve gerar vínculo sem esconder alertas, infantilizar situações sérias ou atrapalhar tarefas.

## 5. Modelo organizacional

### 5.1 Organização ASA

**Consolidado:** a Arts and Sports Academy é uma organização única. Direção, Gestão, Supervisão, elenco, Produção, professores, treinadores, profissionais convidados e demais participantes pertencem ao mesmo ecossistema.

### 5.2 Operação

Uma Operação é o contexto em que uma programação operacional acontece. Pode representar um parque, empreendimento, cliente ou frente de trabalho com programação e Escala próprias.

Operações atuais:

- Snowland;
- Acquamotion;
- Hotelaria.

Uma nova frente pode virar Operação quando precisar de programação, responsáveis e Escala próprios. Uma temporada diferente não cria obrigatoriamente outra Operação; ela pode ser uma versão de programação da Operação existente.

Snowland não deve ser arquivada apenas por mudança de temporada. Arquivamento serve para encerramento, suspensão prolongada ou cadastro incorreto.

### 5.3 Equipe

Equipe é a organização permanente ou duradoura de pessoas dentro da ASA. Existe apenas um conceito chamado **Equipe**.

Equipes atuais:

- Patinação;
- Bailarinos;
- Produção, incluindo Figurino;
- Gestão.

Novas Equipes podem ser criadas. Uma pessoa possui uma Equipe principal e pode colaborar com outras. Uma Equipe pode atuar em uma, várias ou todas as Operações.

### 5.4 Pessoa

Pessoa é o cadastro humano da ASA. Ela pode existir mesmo sem login. Uma pessoa pode:

- ter uma Operação base;
- participar de outras Operações quando convocada;
- ter uma Equipe principal;
- colaborar com outras Equipes;
- exercer uma função profissional principal;
- assumir responsabilidades diferentes conforme o contexto.

### 5.5 Atividade e Show

Atividade é aquilo que precisa acontecer em determinado contexto e horário. Exemplos: show, ensaio, aula, treinamento, fisioterapia, reunião operacional, preparação, produção, almoço, passagem e tarefa com horário.

Show é uma atividade artística que pode possuir Livro oficial, personagens, cenas, posições, regras de substituição e uma edição diária.

### 5.6 Projeto e evento ASA

Um projeto ou evento pode reunir pessoas de várias Operações, como competição, apresentação especial ou ação institucional. Ele não precisa virar Operação se for temporário e não possuir uma programação operacional independente e contínua.

## 6. Termos que não devem ser confundidos

| Termo | Significado |
|---|---|
| **Operação** | Contexto em que o trabalho acontece e que possui programação/escala própria. |
| **Equipe** | Agrupamento organizacional principal das pessoas da ASA. |
| **Função profissional** | O que a pessoa exerce, como patinadora, bailarina, produção ou fisioterapeuta. |
| **Perfil de acesso** | Nível geral de acesso ao sistema. |
| **Responsabilidade** | Autoridade sobre uma Equipe, show, atividade ou outro escopo. |
| **Agenda** | Calendário de compromissos, eventos, reuniões e datas. |
| **Programação** | O que uma Operação normalmente precisa realizar em cada dia e horário. |
| **Livro do Show** | Modelo oficial e reutilizável de um espetáculo. |
| **Livro do Dia** | Adaptação daquele Livro para uma data específica. |
| **Escala** | Distribuição das pessoas nas atividades do dia. |
| **Meu Dia** | Visão pessoal consolidada do que cada usuário precisa saber e fazer. |

## 7. Perfis, funções e participação

### 7.1 Perfis de acesso do MVP

#### Administração autorizada

Perfil equivalente ao trabalho administrativo realizado atualmente por Babi e à conta de administrador do piloto.

Pode:

- criar e manter Operações, Equipes, Pessoas e contas;
- configurar permissões, responsáveis e prazos;
- consultar a organização inteira;
- atuar quando uma decisão é escalada;
- acessar históricos administrativos autorizados;
- corrigir cadastros e reativar itens arquivados.

Não deve entrar automaticamente no elenco escalável apenas por ser Administradora.

#### Direção

Perfil de visão ampla e decisão estratégica, representado atualmente por Cris.

Pode consultar a operação geral, indicadores, situações críticas e conteúdos autorizados. Não precisa receber as mesmas tarefas de configuração diária da Administração.

#### Supervisão

Perfil operacional da ASA. O que cada supervisor pode visualizar, aprovar ou alterar depende das responsabilidades atribuídas.

Um supervisor pode ser responsável por:

- uma Equipe inteira;
- parte de uma Equipe em uma Operação;
- um show;
- uma atividade;
- um projeto;
- uma etapa da Escala.

#### Membro

Perfil das pessoas que recebem e executam atividades. Visualiza a própria realidade, conteúdos publicados relacionados e informações coletivas liberadas para seu público.

### 7.2 Função profissional não é perfil

Patinadora, bailarina, produção, figurino, gestão administrativa, treinador, professor e fisioterapeuta são funções profissionais ou áreas de atuação. Elas não concedem automaticamente autoridade global no aplicativo.

Cada pessoa possui uma função principal. Capacidades adicionais não devem virar uma lista geral desorganizada de “habilidades”. Quando uma capacidade for necessária para um show ou atividade, ela deve ser registrada naquele contexto, como elegibilidade para personagem, posição, modalidade ou substituição.

### 7.3 Condições especiais de participação

- **Convidado:** pode ser cadastrado, ativado por um período e reativado em uma visita futura. Não possui obrigações trabalhistas nem recebe automaticamente toda a rotina do elenco.
- **Professor, treinador ou fisioterapeuta:** pode ter acesso somente às aulas, comunicados, materiais e participantes necessários ao seu trabalho.
- **Produção e Figurino:** participam da organização operacional e podem também ser convocados artisticamente quando aplicável.

**Proposta para validação:** tratar essas condições por vínculo e escopo de participação, sem criar novos perfis globais, salvo se o uso real mostrar necessidade.

## 8. Visibilidade e privacidade

### 8.1 Regra geral

O acesso combina quatro perguntas:

1. Qual é o perfil de acesso da pessoa?
2. Em quais Operações, Equipes ou atividades ela participa?
3. Quais responsabilidades estão ativas?
4. O conteúdo foi publicado para qual público?

### 8.2 Visão do membro

Um membro não fica restrito somente à Operação base. Ele vê, em uma visão pessoal consolidada, tudo para o que foi convocado, ainda que venha de Snowland, Acquamotion, Hotelaria ou evento ASA.

Isso não concede acesso à gestão completa dessas Operações.

### 8.3 Dados administrativos privados

Observações administrativas, situação contratual, histórico de acesso e outros dados sensíveis ficam limitados à Administração e às pessoas especificamente autorizadas. Um supervisor vê apenas dados necessários ao seu escopo.

Informações de saúde e ocorrências devem ser mostradas pelo mínimo necessário. Para a operação, pode bastar saber que a pessoa está indisponível e que existe uma necessidade de cobertura; o detalhe permanece privado.

## 9. Responsabilidades e delegações

### 9.1 Conceitos oficiais

Para evitar que toda autoridade seja chamada de “delegado”, o produto utiliza:

- **Responsável principal:** dono regular da decisão naquele escopo;
- **Responsável auxiliar:** ajuda de forma recorrente, dentro dos limites definidos;
- **Responsável delegado:** recebe uma autoridade específica até revogação;
- **Responsável temporário:** substitui ou responde durante um período definido.

Capitão e responsável não são novos perfis de acesso.

### 9.2 Regras

- Toda Equipe possui um supervisor principal no MVP.
- Shows e atividades podem possuir responsáveis próprios.
- Uma responsabilidade deve informar escopo, ações permitidas, início, fim opcional e quem a concedeu.
- Uma delegação permanente continua até revogação.
- Uma delegação temporária respeita seu período.
- A ausência de um responsável pode ativar um substituto previamente configurado.
- O sistema nunca deve escolher silenciosamente um substituto sem regra ou confirmação.
- Se não houver autoridade disponível antes do prazo, a decisão sobe para a Administração responsável.

### 9.3 Participações habituais

Uma pessoa que participa habitualmente de um show não precisa gerar uma solicitação diária para seu supervisor principal. A participação pode ser previamente autorizada naquele show ou atividade.

Nova aprovação é necessária quando houver:

- conflito de horário;
- folga ou indisponibilidade;
- convocação excepcional fora das regras conhecidas;
- impacto sobre outra atividade prioritária;
- dúvida sobre autoridade ou elegibilidade.

## 10. Ciclo operacional diário

O ciclo típico acontece assim:

1. A Programação informa o que deve acontecer no dia seguinte.
2. Responsáveis por shows e atividades informam necessidades ou validam as regras recorrentes.
3. Folgas, férias, restrições, ocorrências e indisponibilidades retiram ou limitam candidatos.
4. Livros oficiais ajudam a gerar os Livros do Dia.
5. O sistema propõe pessoas elegíveis para as atividades e aponta conflitos.
6. O responsável pela Escala revisa a proposta e resolve pendências.
7. Escala e Livros do Dia são publicados de forma coordenada.
8. Cada pessoa recebe somente sua programação e as mudanças que a afetam.
9. Alterações posteriores geram republicação, histórico e comunicação dirigida.

O objetivo da automação não é eliminar a decisão humana. É retirar o trabalho repetitivo e destacar apenas as exceções.

## 11. Especificação dos módulos

### 11.1 Acesso e conta

**Objetivo:** permitir acesso seguro sem confundir cadastro da pessoa com conta de login.

**Regras consolidadas:**

- uma pessoa pode existir sem login;
- conta pode ser ativada, desativada e reativada;
- padrão de usuário: `nome.sobrenome`, com ajuste para duplicidades;
- Administração pode gerar nova senha temporária;
- usuário pode alterar foto, nome de uso, telefone, e-mail e senha;
- arquivar preserva histórico e retira a pessoa das participações futuras;
- exclusão definitiva existe somente para cadastro criado por engano, sem histórico relevante.

**Estados da pessoa:** ativa, afastada, desligada/desativada e arquivada. Convidados podem possuir período de participação e ser reativados posteriormente.

### 11.2 Início e Meu Dia

**Objetivo:** ser a porta de entrada útil do aplicativo.

**Meu Dia** é a visão pessoal. Abre em Hoje e reúne:

- atividades publicadas do dia em todas as Operações;
- horário, local e Operação de cada atividade;
- papel ou posição quando houver Livro do Dia;
- mudanças ainda não confirmadas;
- check-in do dia;
- tarefas e solicitações que precisam de ação;
- avisos relevantes;
- próximos compromissos confirmados.

**Início** é a composição adaptada ao perfil:

- Membro recebe Meu Dia como foco;
- Supervisão recebe Meu Dia mais pendências de seu escopo;
- Direção recebe resumo de saúde e situações críticas;
- Administração recebe visão organizacional e configurações pendentes.

O Início não deve repetir o Painel Operacional inteiro.

### 11.3 Operações

**Objetivo:** organizar os contextos de trabalho da ASA.

Cada Operação possui:

- nome, descrição e situação;
- cliente ou empreendimento, quando aplicável;
- locais;
- programação;
- atividades e shows;
- Equipes que atuam naquele contexto;
- elenco base ou pessoas de referência;
- responsáveis;
- Escalas;
- conteúdos e indicadores próprios.

Uma atividade compartilhada aparece nas Operações envolvidas e na visão pessoal dos convocados, mantendo uma origem responsável única para evitar duplicidade.

Operações podem ser ativas ou arquivadas. Arquivamento remove das áreas ativas e preserva histórico.

### 11.4 Pessoas e usuários

**Objetivo:** manter quem faz parte da ASA, com ou sem acesso ao aplicativo.

Cadastro principal:

- nome completo;
- nome de uso;
- foto;
- telefone;
- e-mail;
- data de nascimento;
- data de entrada na ASA;
- situação;
- função principal;
- Equipe principal;
- Operação base, quando houver;
- condição de participação, quando aplicável;
- observações administrativas privadas;
- situação da conta de acesso.

Mudanças de Equipe principal e Operação base preservam o histórico anterior.

### 11.5 Equipes

**Objetivo:** mostrar como as pessoas se organizam dentro da ASA.

Cada Equipe possui:

- nome e descrição;
- situação;
- supervisor principal;
- auxiliares ou responsáveis ativos;
- membros atuais;
- Operações em que atua;
- histórico de composição.

Administração autorizada cria e arquiva a estrutura. Supervisores gerenciam membros e responsabilidades dentro do próprio escopo.

**Proposta para validação:** supervisor pode solicitar uma nova Equipe, mas a criação final fica com Administração para evitar duplicidades.

### 11.6 Atividades e shows

**Objetivo:** criar um catálogo reutilizável do que a ASA realiza.

Uma atividade pode conter:

- nome, tipo, descrição e ícone;
- cor configurável;
- Operação principal e locais possíveis;
- Equipes normalmente envolvidas;
- responsável principal;
- quantidade ou composição necessária;
- duração e horários possíveis;
- recorrência;
- critérios de elegibilidade;
- necessidade ou não de Livro;
- regras de prioridade e substituição.

Uma atividade pode ocorrer em vários dias e horários. A ocorrência do dia é diferente do modelo reutilizável.

### 11.7 Programação da Operação

**Objetivo:** responder o que uma Operação precisa realizar em cada dia, antes de escolher as pessoas.

Fica dentro do contexto de Escalas e reúne:

- shows e seus horários;
- aulas e treinamentos;
- ensaios operacionais;
- fisioterapia e acrobacia;
- preparação, figurino, maquiagem e produção;
- passagens e ajustes técnicos;
- refeições e intervalos relevantes;
- atividades administrativas com impacto operacional;
- atividades recorrentes ou excepcionais.

Deve aceitar:

- vários horários para a mesma atividade;
- diferentes dias da semana;
- versões de baixa e alta temporada;
- vigência com data inicial e final;
- exceção de uma data sem alterar o modelo inteiro;
- cópia de programação entre dias ou períodos.

Agenda pode originar um compromisso; quando ele se torna execução operacional confirmada, passa a alimentar a Programação e, depois, a Escala.

### 11.8 Livro do Show

**Objetivo:** guardar a estrutura oficial e reutilizável de um espetáculo.

O Livro oficial descreve o “dia ideal” e pode ser simples ou detalhado. Pode conter:

- cenas e blocos;
- personagens e papéis;
- posições;
- quantidade de pessoas;
- ordem e relações entre participantes;
- titulares, rodízios e substitutos;
- critérios de elegibilidade;
- notas de figurino, produção e execução;
- horários ou ligação com ocorrências da Programação;
- versões por temporada.

O catálogo de personagens pode ser compartilhado entre shows, evitando duplicidades.

Alterar o Livro oficial não muda silenciosamente um Livro do Dia já publicado.

### 11.9 Livro do Dia

**Objetivo:** adaptar o Livro oficial à realidade de uma data.

É gerado considerando:

- ocorrência do show;
- pessoas previstas e rodízios;
- folgas, férias, restrições e ocorrências;
- outras convocações e conflitos;
- substitutos e regras do show.

O responsável revisa a proposta. Quando uma pessoa é alterada no Livro do Dia, a atividade correspondente na Escala deve ser atualizada; uma mensagem isolada não substitui essa alteração.

O Livro do Dia é publicado junto com a Escala. O membro só visualiza Livros para os quais foi convocado, salvo permissão específica. Ao abrir a atividade, vê seu nome ou posição destacados.

### 11.10 Escalas

**Objetivo:** definir quem executará cada atividade. É o coração operacional do My ASA.

#### Preparação

- A primeira versão prioriza Escala diária.
- Normalmente a Escala de amanhã é preparada hoje.
- Cada Operação possui um responsável pela Escala e substitutos configuráveis.
- O horário limite é configurável. Exemplo atual: Escala de terça publicada até segunda às 21h.
- A Escala pode ser publicada antes do limite.

#### Grade

A grade deve ser visual, flexível e semelhante à facilidade de uma planilha:

- pessoas nas linhas e tempo nas colunas;
- horários adaptados às atividades, sem limitar tudo a blocos de uma hora;
- arrastar, copiar e repetir blocos como evolução desejada;
- filtros por Operação, Equipe, pessoa e tipo;
- cores e ícones personalizáveis;
- visão por pessoas e visão por atividades;
- indicação clara de folga, disponibilidade, conflito e item incompleto.

#### Automação

O sistema pode gerar uma proposta usando Programação, Livros, recorrências, folgas e regras. Deve explicar pendências e nunca publicar sozinho.

Participações habituais autorizadas não exigem aprovação diária. Exceções e conflitos são encaminhados ao responsável correto.

#### Publicação e republicação

- responsável pela Escala faz a checagem final;
- publicação cria uma versão oficial;
- supervisor autorizado pode republicar rapidamente em urgência dentro do seu escopo;
- republicação registra autor, horário, motivo e itens alterados;
- somente as pessoas afetadas recebem destaque da mudança;
- mudança crítica permanece visível até confirmação quando necessário;
- histórico anterior permanece consultável.

#### Transição

Durante a transição, pode existir exportação visual ou formato compartilhável semelhante à planilha/PDF atual, até que o elenco confie no aplicativo como fonte principal.

### 11.11 Painel Operacional

**Objetivo:** permitir que Direção, Administração e Supervisão entendam se o dia está coberto e onde precisam decidir.

Deve mostrar conforme escopo:

- cobertura das Operações;
- shows e atividades completos ou incompletos;
- pessoas escaladas e indisponíveis;
- conflitos;
- pendências de publicação;
- solicitações aguardando decisão;
- ocorrências e riscos do dia;
- últimas mudanças relevantes.

Supervisores veem seu escopo e atividades relacionadas. Gestão pode alternar entre visão geral e cada Operação. Membro não recebe o painel administrativo completo.

### 11.12 Agenda

**Objetivo:** funcionar como calendário semelhante ao Google Calendar.

Inclui:

- reuniões;
- eventos ASA;
- ensaios planejados;
- datas importantes;
- compromissos de projetos;
- prazos;
- compromissos pessoais privados, se mantidos no produto.

Cada item possui visibilidade: privada, convidados, Equipe, Operação, Supervisão/Gestão ou toda ASA.

Agenda não é Escala. Um ensaio pode ser anunciado antes da Escala, se sua visibilidade permitir. Quando confirmado como atividade operacional, passa a alimentar a Programação; a convocação individual oficial acontece pela Escala publicada.

### 11.13 Check-in e ocorrências

**Objetivo:** informar prontidão e comunicar impedimentos, sem controle de jornada.

O check-in acontece uma vez ao dia. Estados iniciais:

- estou pronto para as operações;
- vou me atrasar;
- preciso informar uma ocorrência.

Atraso solicita previsão e observação curta. Doença, acidente, emergência ou impossibilidade de comparecer abrem uma ocorrência dirigida ao supervisor responsável.

A ocorrência pode:

- marcar indisponibilidade provisória;
- alertar quem precisa reorganizar o dia;
- abrir necessidade de substituição;
- proteger detalhes sensíveis;
- registrar desfecho posterior.

### 11.14 Folgas, indisponibilidades e solicitações

**Objetivo:** registrar necessidades que afetam planejamento e disponibilidade.

Tipos iniciais:

- solicitação de folga;
- troca de folga;
- indisponibilidade;
- restrição;
- ajuste de Escala;
- chegada tardia;
- saída antecipada;
- solicitação excepcional;
- solicitação administrativa.

Fluxo geral: solicitação → análise pelo responsável → decisão → impacto nas superfícies relacionadas → comunicação → histórico.

Folga aprovada retira a pessoa das propostas daquele período. Uma restrição pode limitar atividade sem tornar a pessoa indisponível para tudo. Alterações posteriores à publicação exigem avaliação e, quando afetarem a Escala, republicação.

### 11.15 Tarefas

**Objetivo:** organizar demandas com responsável, prioridade e conclusão verificável.

Exemplos: conserto de figurino, preparação de áudio, revisão de documento, criação de material e ação administrativa.

Uma tarefa possui:

- título e descrição;
- responsável ou Equipe;
- solicitante;
- prioridade;
- prazo;
- Operação, show, atividade ou projeto relacionado;
- estado;
- comentários e evidências opcionais.

Estados iniciais: a fazer, em andamento, aguardando, concluída e cancelada.

Tarefa com horário e impacto na execução pode aparecer no Meu Dia e na Escala; tarefa sem horário permanece na lista de tarefas e nos resumos.

### 11.16 Avisos, Mural e Mensagens

**Aviso** é comunicação oficial para um público definido. Pode exigir confirmação de leitura.

**Mural** é a superfície organizada onde avisos atuais ficam visíveis. Portanto, Mural não precisa ser um tipo separado de conteúdo; pode ser a apresentação dos Avisos.

**Mensagem** é conversa direta ou em grupo. Pode estar relacionada a uma atividade, solicitação, tarefa ou ocorrência.

Regras:

- conteúdo respeita Organização, Operação, Equipe e participantes;
- mensagem não altera silenciosamente a Escala ou o Livro;
- quando uma conversa resultar em decisão operacional, o sistema propõe registrar a mudança na fonte correta;
- avisos importantes podem exigir confirmação;
- notificações devem ser agrupadas e direcionadas.

### 11.17 Biblioteca

**Objetivo:** ser a fonte confiável de documentos e conhecimento.

Pode conter:

- manuais;
- procedimentos;
- regulamentos;
- materiais de treinamento;
- coreografias, vídeos e referências;
- documentos de Produção e Figurino;
- conteúdos institucionais;
- materiais por Operação, Equipe, show ou projeto.

Cada item possui responsável, público, versão e situação. Conteúdo substituído deve permanecer no histórico, mas apenas a versão vigente aparece como padrão.

A assistente ASA pode consultar somente materiais que o usuário também teria permissão para acessar.

### 11.18 Reconhecimentos

**Objetivo proposto:** valorizar contribuições reais e fortalecer cultura.

Pode registrar agradecimentos, conquistas, aniversários e destaques, com visibilidade configurável. Não deve criar ranking obrigatório de pessoas nem misturar reconhecimento com avaliação disciplinar.

**Proposta para validação:** manter no produto, mas fora do núcleo inicial até confirmar quem publica, quais categorias existem e como evitar competição indesejada.

### 11.19 Indicadores, relatórios e histórico

**Objetivo:** permitir acompanhamento confiável sem transformar o sistema em avaliação automática de pessoas.

Indicadores iniciais possíveis:

- cobertura de atividades;
- conflitos detectados antes da publicação;
- republicações;
- folgas e solicitações pendentes;
- atividades canceladas;
- cumprimento do prazo de publicação;
- check-ins e ocorrências operacionais em nível agregado;
- volume de tarefas por estado.

Visões podem ser gerais e por Operação, Equipe ou período, respeitando privacidade.

Histórico registra quem fez, quando fez, o que mudou, motivo e versão anterior nas entidades críticas: Pessoas, vínculos, Operações, Equipes, responsabilidades, Programação, Livros, Escalas, solicitações, ocorrências, avisos e ações da IA.

### 11.20 Assistente ASA

**Objetivo:** ajudar pessoas a encontrar informações, entender a operação e realizar tarefas com menos esforço.

Ela pode:

- responder perguntas usando conteúdo permitido;
- resumir Meu Dia;
- explicar mudanças de Escala;
- identificar conflitos e lacunas;
- transformar uma mensagem em proposta estruturada;
- sugerir substituições elegíveis e explicar o motivo;
- ajudar a preparar Escala e Livros do Dia;
- localizar documentos;
- redigir avisos e mensagens;
- lembrar pendências relevantes.

Ela não pode:

- publicar Escala sozinha;
- aprovar folga, restrição ou solicitação sem autoridade humana;
- inventar disponibilidade ou habilidade;
- expor dados de outro usuário;
- mudar uma fonte oficial apenas porque recebeu uma mensagem;
- apresentar sugestão como decisão confirmada.

Fluxo obrigatório para ações: interpretação → proposta visível → confirmação → execução autorizada → registro → possibilidade de correção ou reversão quando aplicável.

### 11.21 Perfil, configurações e notificações

O Perfil reúne dados editáveis pelo próprio usuário, preferências e segurança da conta.

Configurações administrativas incluem prazos, tipos, cores, ícones, visibilidades, responsáveis padrão e regras de notificação.

Notificações iniciais podem ser todas habilitadas. Com a evolução, o usuário poderá personalizar itens informativos, mas não desativar alertas críticos que o afetem diretamente.

Categorias:

- informativa;
- importante;
- crítica;
- alteração operacional que exige confirmação.

Várias mudanças da mesma publicação devem chegar em um resumo, evitando uma notificação por campo alterado.

### 11.22 Marketing e redes sociais

**Futuro:** área ASA para organizar Instagram, TikTok, YouTube e outros canais.

Pode reunir:

- calendário editorial;
- ideias de conteúdo;
- datas importantes;
- campanhas;
- projetos;
- responsáveis;
- etapas de aprovação;
- arquivos e legendas;
- situação de publicação;
- resultados básicos.

Este módulo deve ter descoberta própria antes do design. Não faz parte do núcleo operacional da primeira versão.

### 11.23 Mascote ASA

**Objetivo:** tornar a experiência acolhedora, memorável e consistente.

A ASA pode aparecer em:

- boas-vindas;
- estado vazio;
- confirmação de tarefa concluída;
- orientação curta;
- aniversário e reconhecimento;
- mensagem de folga;
- explicação amigável de erro;
- aparência e acessórios sazonais no futuro.

Regras:

- nunca cortar asas, acessórios ou efeitos;
- manter respiro visual ao redor da personagem;
- não ocupar o lugar de ícones funcionais essenciais;
- não celebrar situações graves;
- não esconder informação operacional;
- diferenciar claramente o símbolo da marca da personagem ilustrada.

## 12. Relações obrigatórias entre módulos

| Origem | Consequência esperada |
|---|---|
| Folga aprovada | Atualiza disponibilidade e sinaliza Escalas/Livros afetados. |
| Ocorrência de ausência | Alerta responsável e abre necessidade de cobertura. |
| Mudança no Livro do Dia | Atualiza a alocação correspondente antes da publicação/republicação. |
| Mudança na Escala publicada | Cria nova versão e notifica somente afetados. |
| Evento confirmado com impacto operacional | Passa da Agenda para a Programação e depois para a Escala. |
| Mensagem com pedido de mudança | Gera proposta na fonte correta; não altera sozinha. |
| Pessoa arquivada | Sai de futuras seleções e mantém registros anteriores. |
| Responsabilidade expirada | Retira autoridade futura sem apagar ações passadas. |
| Documento substituído | Nova versão vira vigente e versão anterior permanece no histórico. |

## 13. Estados e situações que todas as páginas devem prever

Toda experiência relevante precisa definir:

- carregando;
- vazio verdadeiro;
- sem permissão;
- erro recuperável;
- dado arquivado;
- conflito;
- prazo vencido;
- rascunho;
- publicado;
- republicado;
- cancelado;
- ação concluída;
- ausência de responsável;
- uso no celular.

Mensagens devem explicar o que aconteceu e qual é a próxima ação possível.

## 14. Escopo recomendado da primeira versão

### Núcleo obrigatório

1. Pessoas, contas e Equipes;
2. Operações;
3. perfis, responsabilidades e delegações;
4. atividades e Programação;
5. Livro do Show e Livro do Dia;
6. Escala diária, publicação e republicação;
7. Meu Dia;
8. folgas, indisponibilidades e solicitações essenciais;
9. check-in diário e ocorrências;
10. avisos e notificações críticas;
11. histórico das mudanças operacionais.

### Apoio importante, após o ciclo principal funcionar

- Agenda;
- tarefas;
- mensagens;
- Biblioteca;
- Painel Operacional;
- indicadores básicos;
- assistente ASA com ações limitadas e confirmadas.

### Futuro

- planejamento mensal avançado;
- editor visual de palco;
- automações mais autônomas;
- mascote colecionável e sazonal;
- reconhecimentos avançados;
- Marketing e redes sociais;
- indicadores analíticos avançados.

## 15. Perguntas ainda abertas para validação

Estas perguntas não impedem entender o produto, mas devem ser respondidas antes do design final dos respectivos módulos.

1. **Operações:** o elenco base será exibido formalmente na página da Operação ou apenas derivado das pessoas com aquela Operação base?
2. **Equipes:** supervisor poderá solicitar criação de Equipe, mantendo aprovação final com Administração?
3. **Convidados:** quais conteúdos mínimos um convidado com login poderá acessar?
4. **Professores e profissionais externos:** precisarão conversar diretamente com turmas pelo My ASA na primeira versão?
5. **Agenda pessoal:** compromissos privados do membro continuam dentro do My ASA ou o calendário será somente institucional?
6. **Livro do Show:** quais campos são obrigatórios até para um Livro simples?
7. **Livro do Dia:** quem é o responsável final por cada Livro quando um show envolve duas Equipes?
8. **Escala:** quais alertas podem ser ignorados na publicação e quais devem bloquear?
9. **Republicação urgente:** existe algum limite de escopo ou horário além da responsabilidade ativa?
10. **Confirmação:** quais mudanças exigem confirmação explícita do membro?
11. **Check-in:** até que momento do dia ele fica disponível e quem vê o status detalhado?
12. **Solicitações:** qual é o responsável padrão de cada tipo e qual o prazo de decisão?
13. **Tarefas:** membro poderá criar tarefa somente para si ou também sugerir tarefa para outra pessoa?
14. **Mensagens:** haverá grupos livres ou somente conversas criadas a partir de contextos oficiais?
15. **Reconhecimentos:** o módulo entra na primeira versão ou fica para uma etapa posterior?
16. **Indicadores:** quais números são realmente úteis para Direção, Gestão e Supervisão sem avaliar pessoas de forma inadequada?

## 16. Critério de aprovação do produto por módulo

Antes de qualquer módulo seguir para implementação, deve existir:

1. objetivo compreendido;
2. regras aprovadas;
3. responsáveis e autoridades definidos;
4. visibilidade por perfil definida;
5. relações com outros módulos definidas;
6. estados de exceção previstos;
7. limite entre primeira versão e futuro;
8. interface web aprovada;
9. comportamento mobile essencial aprovado;
10. relatório prévio da mudança e autorização da responsável do produto.

## 17. Próxima etapa recomendada

Revisar este documento por blocos, na seguinte ordem:

1. modelo organizacional, perfis e visibilidade;
2. ciclo Escala–Programação–Livros;
3. Meu Dia, Check-in, Folgas e Solicitações;
4. Agenda, Tarefas e Comunicação;
5. Biblioteca, Indicadores e Assistente ASA;
6. escopo definitivo da primeira versão.

Depois da aprovação dos blocos, este arquivo passa à versão 1.0 e torna-se a referência funcional principal para organizar o Figma. O código só deverá ser analisado novamente depois dessa validação de produto.

## 18. Fontes consolidadas

- notas de produto da pasta `Downloads/claude notas`;
- `docs/DECISOES-APROVADAS.md`;
- `docs/MAPA-GERAL-MYASA.md`;
- documentos funcionais e de arquitetura existentes no projeto;
- explicações e aprovações fornecidas pela responsável do produto ao longo das conversas do My ASA;
- exemplos reais de Escalas e Livros fornecidos pela ASA.

