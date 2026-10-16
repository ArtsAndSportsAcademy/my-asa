# Mapa de revisão das telas (16/10/2026)

Existe para responder, num lugar só, "o que já foi revisado com o crivo das 16 perguntas e o que não foi".
Foi montado a partir do menu real do app (`shell-foundation.tsx`), dos handoffs de 14, 15 e 16/10 e do histórico
do git. Onde a fonte é só o git (data do último commit na tela), está dito. **Quando uma tela for revisada,
atualize a linha dela.**

Legenda: **Revisada** = passou pelas 16 perguntas e foi vista no navegador. **Parcial** = só uma passada
(rodapé, mensagens, um fluxo). **Pendente** = sem registro de revisão com o crivo.

## Porta de entrada

| Tela | Situação | De onde vem a informação |
|---|---|---|
| Meu Dia | Revisada (sessões de setembro/outubro; última mudança de código em 01/10) | AGENTS.md "pronto e em produção" |

## O dia

| Tela | Situação | De onde vem a informação |
|---|---|---|
| Agenda | **Revisada** em 15/10, a 375 px, com a empresa de teste | handoff 15/10 |
| Escalas (Escala do dia e Programação) | Revisada (Programação com rascunho e rodapé) | AGENTS.md; commit c64e2bf |
| Shows | **Parcial**: só a varredura de rodapé (c64e2bf, 15/10). Não há registro das 16 perguntas | git |
| Livro do Dia | Revisada (vivo, Hoje/Amanhã, hora e local na lista) | AGENTS.md; commit 4eea7b4 |
| Check-in e ocorrências | Revisada (check-in por turno) | AGENTS.md |
| Responsabilidades e tarefas | **Revisada** em 15/10 (lote, cancelar tarefa, avisos) | handoff 15/10 |
| Folgas e solicitações | **Parcial**: primeira passada do crivo em 14/10 (commit 87698d9) e Etapas 1 e 2 (lote, Gerar o mês). Falta o Mapa do mês, "Definir folga" e a Etapa 3 | handoff 14/10 |

## Gestão

| Tela | Situação | De onde vem a informação |
|---|---|---|
| Painel | **Revisada** em 15/10 (navegação de dia, vagas por dia, folgas) | handoff 15/10 |
| Locais | **Revisada** em 15/10 (dentro de Cadastros; reabrir local pede motivo) | handoff 15/10 |
| Pessoas e acessos | **Revisada** em 15/10 (dentro de Cadastros; desligar várias pessoas) | handoff 15/10 |
| Áreas | **Revisada** em 15/10 (dentro de Cadastros; reabrir área) | handoff 15/10 |
| Registro | **Pendente**: última mudança em 01/10; não há registro de revisão com o crivo | git |
| ~~Grupos~~ | **Removida do menu em 16/10/2026** a pedido da Babi (era a tela antiga de equipes operacionais). Ver "Os três 'grupos'" abaixo | esta sessão |

## Comunicação

| Tela | Situação | De onde vem a informação |
|---|---|---|
| Avisos e Mural | Revisada (Mural aberto) em 14/10. Datas especiais: cadastro vazio, a Babi passa a lista | handoff 16/10 |
| Mensagens | Revisada (com grupos) em 14–15/10. Push web de mensagem ligado, genérico | handoffs 16/10 e 15/10 |
| Biblioteca | **Revisada** em 15/10 (avisos, "quem já leu", versões, arquivar) | handoff 15/10 |

## Fora do menu principal

| Tela | Situação |
|---|---|
| Perfil (silêncio noturno) | **Parcial**: rodapé feito, mas a Babi precisa conferir no telefone (exige login) |
| Solicitações (aba de Folgas) | **Parcial**, junto com Folgas |
| Login e troca de senha | Corrigidos em 10/10 (mensagem de erro de servidor, sessão que não cai); sem passada completa do crivo |

## O que falta, em ordem

1. **Etapa 3 de folgas** (pedido como troca, calendário do mês, grade pessoa×dia). As respostas da Babi estão em
   `docs/plano-folga-como-troca-e-mes-em-rascunho.md`.
2. Depois da Etapa 3: revisar **Folgas e solicitações, Mapa do mês, "Definir folga" e Grupos de folga** com as 16 perguntas.
3. Revisar com o crivo **Shows** e **Registro**, e a passada completa de **Perfil** e **Login**.
4. **Revisão geral e completa de tudo**, no fim, com o `code-review` e com testes de tela no Playwright (desktop e 375 px).

## Os três "grupos" (não confundir)

- **Grupos de folga** (Folgas → Grupos): padrão de pessoas e dias de folga; na alta temporada, definidos por
  Deb, Victor e Tef. Continuam.
- **Grupos da casa** (Mensagens → Grupos da casa): conversas privadas em grupo. Continuam.
- **Grupos / equipes operacionais** (antiga aba "Grupos" do menu, `pages/admin/groups.tsx` e
  `pages/supervisor/grupos.tsx`): **tirada do menu e da rota em 16/10/2026**. Os arquivos da tela e a API
  continuam no repositório, sem uso; nenhum dado foi apagado. Se um dia quiser tirá-los de vez, é uma limpeza
  à parte (antes, conferir o que a Supervisão usa de `operational-groups` na API).

## Correção a um handoff anterior

O handoff de 15/10 diz que as telas `pages/admin/*`, `supervisor/*` e `membro/*` não têm rota. Era verdade para
quase todas, mas **`/grupos` abria `admin/groups.tsx` e `supervisor/grupos.tsx`**. Isso acabou com a remoção acima.
