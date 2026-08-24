# Decisões Aprovadas do My ASA

Atualizado em: 23 de agosto de 2026

Este arquivo registra decisões vigentes de produto. Documentos históricos que
divergirem destas decisões devem ser revisados antes de orientar o código ou o
Figma.

## Organização e Operações

- A Arts and Sports Academy é uma organização única.
- As Operações atuais são Snowland, Acquamotion e Hotelaria.
- Uma nova frente com programação, elenco e Escala próprios pode tornar-se uma
  nova Operação.
- Uma pessoa pode ter uma Operação base e participar de outras.
- Uma atividade compartilhada deve aparecer nos contextos operacionais
  envolvidos e na visão consolidada da pessoa convocada.
- Operações encerradas são arquivadas; o histórico é preservado.

## Pessoas, contas e funções

- Pessoa e conta de acesso são conceitos separados.
- Uma pessoa pode ser cadastrada sem login.
- A conta pode ser ativada, desativada e reativada sem recriar a pessoa.
- Pessoas desligadas ou arquivadas não são apagadas do histórico.
- Função profissional não é perfil de acesso.
- Cada pessoa possui uma função principal; capacidades adicionais devem ser
  registradas no contexto em que forem necessárias, evitando um cadastro geral
  de habilidades desorganizado.
- O próprio usuário pode alterar foto, nome de uso, telefone, e-mail e senha;
  dados administrativos permanecem sob gestão autorizada.
- O padrão de usuário é `nome.sobrenome`, com tratamento de duplicidades.

## Equipes

- Existe um único conceito chamado Equipe.
- Equipes atuais: Patinação, Bailarinos, Produção e Gestão.
- Figurino integra a Equipe de Produção.
- Novas Equipes podem ser criadas.
- Cada pessoa pode ter uma Equipe principal e colaborar com outras.
- Cada Equipe possui supervisor principal e pode ter auxiliares, responsáveis
  temporários e delegados.
- Uma Equipe pode atuar em uma, várias ou todas as Operações.
- A composição e o histórico de vínculos das Equipes são preservados.

## Perfis, responsabilidades e delegações

- O MVP possui quatro perfis de acesso: Administração autorizada, Direção,
  Supervisão e Membro.
- Administração autorizada configura e governa; Direção possui visão ampla
  prioritariamente de consulta; Supervisão decide somente dentro do seu escopo;
  Membro acessa o próprio contexto e conteúdo publicado relacionado.
- Treinador, professor, fisioterapeuta, convidado, produção, figurino e demais
  profissões ou áreas não são autoridades globais; são funções,
  especializações, Equipes ou condições de participação.
- Capitão, responsável temporário e delegado não são perfis de acesso. São
  responsabilidades contextuais e auditáveis.
- Supervisor é um perfil da ASA; suas responsabilidades definem o que controla.
- Um supervisor pode cuidar de Equipes, grupos, shows ou atividades em mais de
  uma Operação.
- Responsabilidades de shows e atividades devem ser personalizáveis.
- Delegações podem ser permanentes ou temporárias.
- Uma delegação permanente continua ativa até revogação; uma delegação
  temporária respeita início e fim configurados.
- Quando uma decisão ultrapassa a autoridade disponível ou perde o prazo, ela
  pode ser escalada para a gestão responsável, atualmente representada por Babi.
- Administrador possui acesso total para configuração e piloto, sem integrar o
  elenco escalável.

## Escalas

- A Escala é o coração do My ASA.
- Os arquivos chamados `Schedule` representam Escalas, não Agenda.
- A primeira versão trabalha prioritariamente com Escala diária.
- Normalmente a Escala de amanhã é preparada hoje.
- O horário limite de publicação é configurável; a Escala pode ser publicada
  antes dele.
- Depois de publicada, uma alteração gera republicação e histórico.
- Em urgência, supervisor autorizado pode agir rapidamente e republicar.
- A pessoa responsável pela Escala faz a checagem final antes da publicação.
- Arthur é o responsável atual; quando ausente, pode haver responsável delegado.
- A grade deve adaptar-se aos horários das atividades e permitir evolução para
  uma experiência semelhante a planilha, inclusive cópia de blocos.
- Cores e ícones de atividades são personalizáveis.
- Notificações devem ser úteis e agrupadas, evitando excesso.
- Participações habituais aprovadas não devem gerar uma solicitação diária para
  cada supervisor; exceções e conflitos exigem decisão.

## Programação, Agenda e Livros

- Agenda e Escala não são a mesma coisa.
- Agenda é um calendário para reuniões, eventos, datas e compromissos, com
  visibilidade configurável.
- Programação da Operação fica dentro de Escalas.
- A Programação reúne atividades recorrentes e horários derivados dos Livros do
  Show.
- Livros oficiais descrevem o espetáculo ideal e suas regras de substituição.
- A instância do dia considera folgas, férias, doenças e ausências.
- Os Livros do dia são publicados junto com a Escala.
- Na Escala individual aparece a atividade; ao abri-la, a pessoa visualiza o
  Livro correspondente e seu nome destacado.
- Um membro não deve visualizar Livros publicados para os quais não foi
  convocado, salvo permissão específica.

## Check-in e ocorrências

- Check-in ocorre uma vez ao dia, não por atividade.
- Ele indica à ASA que a pessoa está pronta para as operações, sem caracterizar
  controle de jornada.
- A pessoa pode informar atraso ou ocorrência no fluxo do check-in.
- Doença, acidente ou impossibilidade de comparecer exige uma ocorrência
  dirigida ao supervisor; não deve ser reduzida a um simples status de presença.

## Interface e identidade

- A conversa `Melhorar layout do My ASA` e o arquivo Figma
  `OH87C1uPdtd4ECLaqpZGwF` são a referência visual oficial.
- A mascote ASA deve ser usada de forma acolhedora, contextual e profissional.
- Stickers utilizam margem transparente mínima de 12,5% e encaixe proporcional;
  nenhuma asa, acessório ou efeito pode ser cortado.
- Interfaces antigas e prompts genéricos são referência, não decisão vigente.

## Governança de publicação

- Toda mudança de código recebe relatório prévio com motivo e impacto.
- A responsável do produto aprova o escopo antes da implementação/publicação.
- Desenvolvimento, Piloto e Produção são ambientes separados.
- Nenhuma publicação ocorre sem testes e aceite do Preview.
- Cada publicação recebe relatório do que mudou e como reverter.
