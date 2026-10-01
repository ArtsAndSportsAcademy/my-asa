# Mapa Geral do My ASA

Atualizado em: 12 de agosto de 2026  
Finalidade: fonte central para a reconstrução controlada do produto

## Visão do produto

O My ASA é a plataforma de gestão operacional da Arts and Sports Academy. A
ASA é uma organização única, formada por pessoas, Equipes e responsabilidades
que podem atuar em diferentes Operações.

Operações atuais:

- Snowland;
- Acquamotion;
- Hotelaria.

A Operação representa o contexto onde a programação e o trabalho acontecem.
Ela pode ter elenco fixo, receber participantes de outras Operações e utilizar
Equipes que atendem uma, várias ou todas as Operações.

## Princípio da reconstrução

O aplicativo será reconstruído módulo por módulo, aproveitando somente o que
estiver correto no sistema atual. Cada módulo passa por cinco fontes de verdade:

1. regras reais da ASA, aprovadas pela responsável do produto;
2. registro funcional mantido neste repositório;
3. interface aprovada no arquivo oficial do Figma;
4. implementação revisada no código;
5. comportamento validado no ambiente Piloto.

Uma tela bonita não aprova uma regra. Uma regra aprovada não autoriza
automaticamente uma publicação.

## Fontes oficiais e precedência

Quando houver divergência, prevalece esta ordem:

1. decisões aprovadas e registradas em `DECISOES-APROVADAS.md` e no documento
   vigente do módulo;
2. design aprovado no arquivo oficial do Figma;
3. relatório de mudança aprovado para a implementação;
4. código validado no ambiente Piloto;
5. documentos históricos ainda não revisados.

### Referência visual oficial

- Conversa/tarefa: `Melhorar layout do My ASA`
- Tarefa Codex: `019ff13a-adab-79c0-8c19-cea180d0bfe3`
- Arquivo Figma: [My ASA — Direção visual e Painel Operacional](https://www.figma.com/design/OH87C1uPdtd4ECLaqpZGwF)
- File key: `OH87C1uPdtd4ECLaqpZGwF`

O arquivo contém a direção visual, painel inicial, navegação, paleta, tipografia,
uso da mascote ASA e kit inicial de stickers. Nem todo conteúdo demonstrativo
dos cards representa regra funcional aprovada.

### Materiais históricos

Os demais documentos, conversas, imagens e prompts anteriores continuam úteis
como pesquisa. Eles não devem ser implementados sem comparação com as decisões
vigentes. Isso inclui documentos antigos que misturam Agenda, Programação da
Operação, Escala, Livro do Dia ou Livro do Show.

## Arquitetura funcional resumida

### Fundação organizacional

- Organização ASA;
- Operações;
- Pessoas e contas de acesso;
- Equipes;
- perfis e permissões;
- responsabilidades;
- delegações.

### Núcleo operacional

- Escalas;
- Programação da Operação;
- Livro do Show;
- Livro do Dia;
- folgas e indisponibilidades;
- solicitações;
- check-in e ocorrências;
- Painel Operacional.

### Planejamento e execução

- Agenda;
- tarefas;
- projetos e entregas;
- Início/Meu Dia.

### Comunicação e conhecimento

- avisos;
- mensagens;
- biblioteca;
- reconhecimentos.

### Gestão e expansão

- indicadores e relatórios;
- assistente ASA;
- mascote interativa;
- Marketing e redes sociais.

## Distinções obrigatórias

### Agenda

É um calendário semelhante ao Google Calendar para reuniões, eventos, datas
importantes, ensaios planejados e compromissos com visibilidade controlada.

### Programação da Operação

Fica dentro do contexto de Escalas. Reúne horários operacionais, atividades
recorrentes e atividades originadas dos Livros do Show.

### Escala

É o coração operacional. Define quais pessoas executarão as atividades da
Programação em determinado dia. Normalmente a Escala do dia seguinte é montada
no dia anterior e pode ser publicada antes do limite configurável.

### Livro do Show e Livro do Dia

O Livro do Show guarda a estrutura oficial e reutilizável do espetáculo. A
instância diária resolve elenco, substituições e adaptações daquele dia e se
integra à Escala. A nomenclatura e a fronteira final entre as superfícies devem
ser validadas durante a revisão específica desses módulos.

## Ambientes

- **Desenvolvimento:** alterações locais e validações técnicas.
- **Piloto/Preview:** testes funcionais sem afetar a futura produção real.
- **Produção:** somente versões aprovadas, testadas e liberadas.

O Supabase `MyASA Piloto` é o banco atual de testes. O banco antigo do Replit
deve permanecer preservado. Antes do uso definitivo será criado um ambiente de
produção separado.

## Processo obrigatório por módulo

1. inventário do que existe no código e no Figma;
2. entrevista apenas sobre lacunas ainda não respondidas;
3. documento funcional do módulo;
4. aprovação das regras;
5. design e estados da interface no Figma;
6. aprovação do design;
7. relatório prévio da mudança de código;
8. implementação em branch própria;
9. validação técnica e cenários funcionais;
10. Preview conectado ao banco Piloto;
11. aceite da responsável do produto;
12. publicação e relatório pós-publicação.

## Critério de conclusão de um módulo

Um módulo só recebe o estado `CONCLUÍDO` quando possui:

- regras aprovadas e registradas;
- design aprovado para os perfis necessários;
- estados vazio, carregando, erro e sucesso;
- permissões e integrações verificadas;
- implementação sem erros técnicos bloqueadores;
- testes funcionais aprovados;
- Preview aceito;
- publicação registrada;
- caminho de reversão conhecido.

