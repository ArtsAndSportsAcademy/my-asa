# Status dos Módulos do My ASA

Atualizado em: 12 de agosto de 2026

## Legenda

- `INVENTÁRIO`: levantamento de código, documentos e Figma.
- `REGRAS`: regras em análise.
- `REGRAS APROVADAS`: comportamento aprovado, ainda sem design final.
- `DESIGN`: protótipo em elaboração ou revisão.
- `DESIGN APROVADO`: pronto para relatório técnico.
- `DESENVOLVIMENTO`: implementação em andamento.
- `TESTE`: disponível ou sendo preparado no Piloto.
- `PUBLICADO`: entregue no ambiente correspondente.
- `REVISAR`: material existente diverge ou está incompleto.

O status se refere à reconstrução nova, não à simples existência de uma página
na versão antiga do aplicativo.

| Ordem | Módulo | Regras | Figma | Código novo | Piloto | Próxima decisão |
|---:|---|---|---|---|---|---|
| 1 | Operações | Regras aprovadas | Admin web aprovado; demais perfis em revisão | Parcial | Parcial | Revisar Supervisão |
| 2 | Pessoas e usuários | Regras aprovadas | Inventário | Parcial | Parcial | Desenhar lista, cadastro e perfil |
| 3 | Equipes | Regras aprovadas | Inventário | Parcial | Pendente | Desenhar Equipes e vínculos |
| 4 | Perfis e permissões | Regras aprovadas | Pendente | Parcial | Pendente | Mapear matriz de acesso |
| 5 | Responsabilidades e delegações | Regras aprovadas | Pendente | Parcial | Pendente | Validar fluxos e telas |
| 6 | Escalas | Regras aprovadas | Revisar | Desenvolvimento local | Pendente | Concluir base e redesenhar tela |
| 7 | Programação da Operação | Regras aprovadas | Pendente | Parcial | Pendente | Fechar fronteiras com Livros |
| 8 | Livro do Show | Parcial | Pendente | Legado/parcial | Pendente | Revisão funcional completa |
| 9 | Livro do Dia | Parcial | Pendente | Legado/parcial | Pendente | Fechar geração e publicação |
| 10 | Folgas e indisponibilidades | Parcial | Pendente | Legado/parcial | Pendente | Revisar solicitações e conflitos |
| 11 | Solicitações | Parcial | Pendente | Legado/parcial | Pendente | Consolidar tipos e aprovações |
| 12 | Check-in e ocorrências | Regras aprovadas | Pendente | Legado/parcial | Pendente | Desenhar fluxo diário e urgência |
| 13 | Agenda | Regras básicas aprovadas | Pendente | Legado/parcial | Pendente | Desenhar calendário e visibilidade |
| 14 | Tarefas | Parcial | Pendente | Legado/parcial | Pendente | Revisar uso por Equipe e Operação |
| 15 | Início / Meu Dia | Parcial | Design inicial | Legado | Pendente | Adequar cards aos dados reais |
| 16 | Painel Operacional | Parcial | Referências + design inicial | Legado | Pendente | Definir painel por perfil |
| 17 | Painel Organizacional | Ideia | Referência antiga | Legado | Pendente | Validar necessidade e indicadores |
| 18 | Avisos | Parcial | Pendente | Legado/parcial | Pendente | Revisar público e confirmação |
| 19 | Mensagens | Parcial | Pendente | Legado/parcial | Pendente | Revisar canais e privacidade |
| 20 | Biblioteca | Parcial | Pendente | Legado/parcial | Pendente | Revisar escopos e permissões |
| 21 | Reconhecimentos | Inventário | Pendente | Legado | Pendente | Confirmar objetivo do módulo |
| 22 | Indicadores e relatórios | Inventário | Pendente | Legado | Pendente | Definir métricas confiáveis |
| 23 | Assistente ASA | Visão aprovada | Design inicial contextual | Legado/parcial | Pendente | Definir ações seguras da IA |
| 24 | Mascote ASA | Regras visuais aprovadas | Biblioteca oficial v1; aplicada em Operações Admin | Assets locais; integração pendente | Pendente | Integrar componentes ao código novo |
| 25 | Marketing e redes sociais | Ideia aprovada | Pendente | Não iniciado | Pendente | Descoberta funcional própria |

## Foco atual

### Fundação antes da nova Escala

1. validar e aprovar o design de Operações;
2. finalizar design de Pessoas e usuários;
3. finalizar design de Equipes;
4. fechar matriz de permissões e delegações;
5. concluir e testar a fundação técnica da Escala;
6. desenhar e integrar a nova interface da Escala.

### Escalas — estado atual detalhado

- Relatório funcional/técnico aprovado em
  `RELATORIO-SEGUNDA-ONDA-ESCALA-2026-08-11.md`.
- Alterações da segunda onda permanecem locais e ainda não foram publicadas.
- A implementação troca papéis de acesso por vínculos de Equipe como fonte do
  elenco escalável.
- Ainda faltam validações técnicas, dados mínimos de Equipes, testes funcionais,
  novo layout aprovado e Preview final.
