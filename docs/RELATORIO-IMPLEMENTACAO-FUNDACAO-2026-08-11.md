# Relatório de implementação — Fundação do My ASA

Data: 11 de agosto de 2026  
Branch: `codex/fundacao-organizacional`

## Escopo desta atualização

Esta etapa atualiza os módulos já revisados e aprovados antes de iniciar a reestruturação da Escala. Nenhuma regra central da Escala, Livro do Dia ou Livro do Show foi alterada.

## 1. Operações

### O que mudou

- A operação passou a registrar descrição, cliente/empreendimento, locais, período, cor, ícone e referência operacional local.
- Arquivamento agora preserva data e responsável pela ação.
- A tela apresenta a operação como contexto de trabalho da ASA, e não como uma empresa ou equipe independente.

### Por quê

Snowland, Acquamotion e Hotelaria são contextos operacionais da mesma ASA. Local, operação responsável e pessoas participantes precisam continuar sendo conceitos separados.

## 2. Pessoas e contas de acesso

### O que mudou

- Pessoa e conta de acesso foram separadas.
- É possível cadastrar uma pessoa sem criar login imediatamente.
- Foram adicionados nome preferido, telefone, situação da pessoa, perfil profissional, função principal, data de entrada, observações privadas e preferências de visibilidade dos contatos.
- O acesso pode ser desativado e reativado sem excluir ou duplicar a pessoa.
- A interface deixou de oferecer exclusão direta de pessoas.

### Por quê

Fisioterapeutas, professores, convidados e outros participantes podem precisar existir no sistema sem possuir o mesmo acesso de um membro fixo. O histórico da pessoa não pode desaparecer quando sua conta é desativada.

## 3. Equipes

### O que mudou

- “Grupos Operacionais” passou a ser apresentado como “Equipes da ASA”.
- O vínculo com uma equipe foi separado do perfil de acesso.
- Uma pessoa pode integrar várias equipes, com uma equipe principal.
- O vínculo guarda início, fim e responsável pelo cadastro, preservando mudanças futuras.
- Equipes podem atender uma, várias ou todas as operações, sem ampliar automaticamente o acesso de equipes antigas.
- Foram adicionados descrição, cor e ícone à estrutura da equipe.

### Por quê

Patinação, Bailarinos, Produção e Gestão pertencem à ASA. As operações em que atuam não devem determinar sozinhas suas permissões nem apagar seu histórico de equipe.

## 4. Responsabilidades e delegações

### O que mudou

- As atribuições agora distinguem pessoa principal, auxiliar e somente leitura.
- Novas atribuições impedem cadastrar outro principal quando já existe um ativo.
- Duplicidades antigas não são corrigidas automaticamente; devem ser revisadas por uma pessoa autorizada.
- Delegações podem ser temporárias ou permanentes até cancelamento.
- A gestão pode criar uma delegação quando for necessário escalar uma decisão.
- Todas as verificações de delegação ativa passaram a reconhecer delegações permanentes.

### Por quê

O responsável principal decide; auxiliares ajudam; outras pessoas podem apenas acompanhar. Delegações permanentes evitam repetir registros a cada folga, enquanto as temporárias continuam atendendo ausências e períodos específicos.

## 5. Início, Meu Dia e Status do Dia

### O que mudou

- O resumo inicial da gestão passou a se chamar “Pulso do Dia”.
- “Check-ins” passou a ser apresentado como “Status do Dia”.
- A linguagem agora indica “pronto”, “vai se atrasar” e “imprevisto”, em vez de controle de presença ou jornada.
- O horário mostrado é chamado de “primeira atividade”, não “entrada”.
- “Meu Dia” permanece como a visão detalhada das atividades e tarefas pessoais.

### Por quê

A ASA trabalha com prestadores PJ. O status diário serve para a operação e para a IA saberem se a pessoa está pronta ou se ocorreu um imprevisto; não é controle de ponto.

## Preservação e compatibilidade

- Três migrações incrementais foram criadas: Operações, Pessoas/Contas, Equipes e Responsabilidades/Delegações.
- Nenhuma migração exclui pessoas, operações, equipes, responsabilidades ou delegações existentes.
- A estrutura antiga de papéis continua sendo alimentada durante a transição para não quebrar Escalas, Folgas e Livro do Dia.
- Equipes antigas não ganharam abrangência geral automaticamente.

## Verificações executadas

- Bibliotecas compartilhadas: aprovadas no TypeScript.
- API: aprovada no TypeScript.
- Contratos e validadores da API: regenerados e aprovados.
- Interface web: as mudanças desta etapa não adicionaram erros de TypeScript.

## Pendências técnicas anteriores a esta etapa

A interface web já possuía cinco problemas de compilação fora deste escopo:

1. conflito entre `AuthContext.ts` e `authContext.ts`;
2. exportação ausente de `AuthProvider`;
3. incompatibilidade de tipos no componente `button-group`;
4. duplicidade de tipos React no componente `calendar`;
5. parâmetro incorreto na consulta de usuários do Mural.

Esses itens devem ser corrigidos antes de considerar a compilação web completamente limpa.

## Próxima etapa recomendada

Retestar esta fundação com os perfis de Babi, supervisor e membro. Depois do aceite, iniciar a implementação do núcleo da Escala diária, mantendo Programação da Operação, Livro do Dia e Livro do Show como fontes integradas.
