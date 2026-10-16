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
| Shows | **Revisada em 16/10** (Administração e Elenco, 375 px): o Elenco recebia "não consegui carregar os shows" junto com "ainda não há shows" porque a lista de locais devolve 403 para ele (corrigido); "1 shows" virou "1 show"; o vazio do Elenco fala com quem só lê | revisão 16/10 |
| Livro do Dia | Revisada (vivo, Hoje/Amanhã, hora e local na lista) | AGENTS.md; commit 4eea7b4 |
| Check-in e ocorrências | Revisada (check-in por turno) | AGENTS.md |
| Responsabilidades e tarefas | **Revisada** em 15/10 (lote, cancelar tarefa, avisos) | handoff 15/10 |
| Folgas e solicitações | **Revisada em 16/10 (Mapa do mês, Grupos de folga e "Definir folga" a 375 px como Administração e Supervisão; janelas com rodapé, Esc e sem transbordo; "Pedir folga" ganhou o botão Voltar e a frase da regra; chips e busca de "Definir folga" passaram a 44 px)**. Antes: **Parcial**: primeira passada do crivo em 14/10 (commit 87698d9), Etapas 1 e 2 (lote, Gerar o mês) e a **Etapa 3 (16/10)**: pedido analisado, troca, mediação e regras, conferidos na empresa de teste a 375 px. Falta o Mapa do mês, "Definir folga" e os Grupos de folga com as 16 perguntas | handoffs 14/10 e 16/10 (sessão 3) |

## Gestão

| Tela | Situação | De onde vem a informação |
|---|---|---|
| Painel | **Revisada** em 15/10 (navegação de dia, vagas por dia, folgas) | handoff 15/10 |
| Locais | **Revisada** em 15/10 (dentro de Cadastros; reabrir local pede motivo) | handoff 15/10 |
| Pessoas e acessos | **Revisada** em 15/10 (dentro de Cadastros; desligar várias pessoas) | handoff 15/10 |
| Áreas | **Revisada** em 15/10 (dentro de Cadastros; reabrir área) | handoff 15/10 |
| Registro | **Revisada em 16/10** (375 px): sem transbordo, filtros e frases claros; as frases de pedido de folga que mostravam data crua (2027-03-15) passaram a "15/03/2027" | revisão 16/10 |
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
| Perfil (silêncio noturno) | **Revisada em 16/10** a 375 px com a empresa de teste: o grupo de opções do aniversário passava 3 px da largura (corrigido); links de toque pequeno já têm área de 44 px. Em **celular simulado** (375 px, toque, Android): silêncio noturno mostra "Ainda não vale" com Descartar e Salvar horário, descartar volta, salvar persiste depois de recarregar; opções de aniversário passaram a 44 px. Falta conferir **no telefone de verdade** (teclado real) |
| Solicitações (aba de Folgas) | **Parcial**, junto com Folgas |
| Login e troca de senha | **Revisado em 16/10** (login a 375 px: campos de 48 px, sem transbordo, "Usuário ou senha não conferem" só quando é isso); **Troca de senha obrigatória** vista em celular simulado em 16/10 (primeiro acesso: campos de 48 px, regras se marcando, mensagens de senha fraca e de "igual à provisória", botão visível, entra no app). Falta o teclado real |

## O que falta, em ordem

1. ~~Etapa 3 de folgas~~ **Feita em 16/10** (pedido analisado, troca, mediação, regras; ver `docs/handoff-2026-10-16-sessao-3.md`). A
   visão do mês (calendário, grade pessoa×dia) e a Etapa 4 (experimentar grupos) seguem pendentes.
2. ~~Folgas (Mapa, Grupos, Definir folga), Shows, Registro, Perfil e Login com as 16 perguntas~~ **Feito em 16/10** (ver as linhas
   acima). O que ainda não foi visto em tela: Perfil no **telefone de verdade**, a troca de senha obrigatória e o PDF da
   Biblioteca no telefone.
3. **Revisão geral e completa de tudo** (código das 5 mudanças desta sessão e das anteriores), com o `code-review`.
4. Depois: visão do mês (calendário e grade pessoa×dia), Etapa 4 (experimentar grupos) e as pendências antigas do handoff.

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

## Campanha com conteúdo completo (16/10/2026, noite)

Diferente das revisões anteriores (que olhavam a tela), esta montou na empresa de teste o conteúdo inteiro e percorreu os
fluxos pela API e pela interface, como Administração, Direção, Supervisão e Elenco.

**O que foi criado:** 3 shows novos (Musical no Gelo completo, com os quatro tipos de linha; Teatro Noturno só personagens;
Formação da Piscina simples), programações dos 3 locais (blocos por dia da semana, de todos, por área e de livro), outubro e
novembro gerados nos 3 locais, folgas de grupo, recesso e afastamento, mapa publicado, 4 pedidos de folga do Elenco, escala
do dia publicada, alterada e republicada, avisos e reconhecimentos no Mural, conversas, reunião e proposta na Agenda,
responsabilidade, tarefa e lote de tarefas.

**Achados e corrigidos:** (1) rodízio sem personagem derrubava a geração do dia inteiro (`71bd2b2`, com teste); (2) o Elenco com
tarefa em aberto via "Nada vence hoje" e nenhuma tarefa (`f23fab1`); (3) o botão da ASA cobria "Gerar o mês" no computador;
(4) a API respondia página HTML em rota inexistente e em JSON quebrado.

**Percorrido depois (mesma noite):** Check-in por turno e ocorrências, Biblioteca (criar, publicar, ciente, versão, escopo por área),
Cadastros (área, local, pessoa: criar, editar, desativar e reabrir com motivo), Perfil (silêncio, privacidade, senha, foto) e Login
(erros sem revelar se o usuário existe), e a decisão de pedido de folga pela tela da Supervisão (a janela espera a análise, que leva
de 2 a 10 s no banco de teste remoto, e a aprovação fecha a janela). Achados: a mensagem de check-in fora do horário não dizia quando
abre ou fechou; arquivo grande demais respondia uma página HTML (413). Ambos corrigidos (`1ade287`).

**Decisão dela / ainda aberto:** encerrar um local não pede motivo (reabrir pede), e encerrar local derruba a geração de escalas
dele. "Gerar o mês" faz poucos dias por chamada (o servidor devolve `restantes` e `proximoDia`): conferir que a tela continua sozinha
até fechar. Agenda e Mensagens foram criadas só pela API; criar pela interface fica para outra rodada.
