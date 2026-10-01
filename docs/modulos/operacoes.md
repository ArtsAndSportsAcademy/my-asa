# Módulo Operações

Atualizado em: 12 de agosto de 2026

## Estado

- regras: aprovadas;
- design: Administração web aprovada pela usuária em 12 de agosto de 2026;
- implementação: parcial no aplicativo existente, ainda não integrada ao novo design.

## Objetivo

Representar os contextos onde o trabalho da ASA acontece sem transformar cada
operação em uma empresa ou hierarquia independente.

As operações atuais são Snowland, Acquamotion e Hotelaria.

## Regras principais

- A ASA é uma única organização.
- Uma pessoa pode ter uma operação base e participar de outras operações.
- A equipe fixa indica o vínculo principal; não limita convocações externas.
- Responsabilidades pertencem a equipes, shows ou atividades específicas, e não
  automaticamente à operação inteira.
- Somente administração autorizada cria, edita ou arquiva operações.
- Direção pode usar a visão administrativa em modo somente leitura.
- Supervisores veem e decidem conforme o seu escopo.
- Membros veem somente conteúdo publicado e relacionado à sua participação.
- Operações são arquivadas, nunca apagadas, preservando escalas, livros, vínculos,
  decisões e auditoria.

## Telas no Figma

Arquivo oficial: https://www.figma.com/design/OH87C1uPdtd4ECLaqpZGwF

Página: `06 — Operações` (`27:2`).

- Administração / Lista (`27:3`): operações ativas, governança e arquivamento.
- Administração / Detalhe (`27:4`): cadastro, equipe fixa, responsáveis e histórico.
- Administração / Nova — Informações básicas (`38:2`): nome, empreendimento,
  local principal e descrição.
- Administração / Nova — Identidade visual (`44:2`): cor, ícone e prévia.
- Administração / Nova — Revisão (`44:60`): conferência antes da criação como
  rascunho de configuração.
- Administração / Editar (`38:57`): dados gerais e acesso separado às
  configurações relacionadas.
- Administração / Arquivar (`38:112`): confirmação explícita e relação do
  histórico preservado.
- Administração / Pós-criação (`51:2`): confirmação de cadastro, status
  `Em configuração`, checklist de preparação e ativação bloqueada.
- Administração / Validações de cadastro (`54:2`): campos obrigatórios,
  operação duplicada e continuação indisponível.
- Administração / Erro ao salvar (`54:60`): preserva a edição na tela e
  permite tentar novamente.
- Administração / Arquivamento concluído (`54:129`): confirma o resultado,
  remove a operação das ativas e oferece acesso ao histórico.
- Administração / Pronta para ativar (`70:2`): cinco etapas concluídas e
  revisão final disponível.
- Administração / Confirmar ativação (`76:2`): confirma o retorno da operação
  aos módulos configurados antes da mudança de status.
- Administração / Ativação concluída (`70:76`): confirma que a operação está
  ativa e disponível.
- Administração / Operações arquivadas (`70:131`): consulta ao histórico e
  acesso à reativação.
- Administração / Confirmar reativação (`70:193`): revisão explícita dos
  vínculos e módulos que voltarão ao uso.
- Administração / Reativação concluída (`77:2`): devolve a operação à
  lista ativa e confirma a preservação do histórico.
- Administração / Estado vazio (`70:266`): orienta a criação da primeira
  operação.
- Administração / Falha ao carregar (`70:336`): informa a falha sem sugerir
  perda de dados e oferece nova tentativa.
- Supervisão (`27:5`): programação, escala, decisões pendentes e ações no escopo.
- Minha visão (`27:6`): atividades, equipe e avisos publicados para a pessoa.

## Fluxo administrativo web

`Lista → Informações básicas → Identidade visual → Revisão → Em configuração → Ativa → Editar → Arquivar`

### Estados e proteções

- Uma operação recém-criada entra em `Em configuração`, nunca diretamente
  como ativa.
- A ativação exige dados gerais, identidade visual, equipe fixa, responsáveis
  por contexto e módulos relacionados concluídos e revisados.
- Enquanto estiver em configuração, a operação não aparece em escalas,
  livros nem no seletor operacional.
- Campos obrigatórios e nomes duplicados bloqueiam o avanço e apresentam uma
  mensagem próxima ao campo.
- Falhas de salvamento mantêm os dados digitados e oferecem nova tentativa.
- Criar e arquivar sempre apresentam confirmação visual do resultado.
- Depois de arquivada, a operação desaparece da lista ativa, mas continua
  acessível no histórico para pessoas autorizadas.
- Ativação e reativação exigem confirmação explícita antes de alterar o
  status da operação.
- A reativação preserva equipe, responsáveis e histórico, retomando somente os
  módulos previamente configurados.
- Estados vazio e de erro sempre explicam o próximo passo disponível.

O fluxo web foi criado e validado visualmente. O mobile deve ser desenhado depois
da aprovação desta sequência, antes da integração no código.

## Critérios de aceite do design

- As quatro visões distinguem claramente as autoridades de cada perfil.
- A operação aparece como contexto, não como uma hierarquia independente.
- Convocações entre operações preservam a operação e a equipe principais.
- Membros não veem rascunhos, dados privados ou livros sem participação.
- O arquivamento preserva todo o histórico.

## Próximo passo

Revisar e aprovar a visão web de Supervisão. Depois, revisar Minha visão e a
matriz entre os perfis antes de desenhar a adaptação mobile e preparar o relatório
técnico de integração com o aplicativo.
