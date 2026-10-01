# Tela 13 · Shows — especificação completa

Extraída de `telas/13 Shows.dc.html`, linha a linha. É o que faltava: as rodadas anteriores
descobriam no protótipo coisas que o texto não descrevia. Aqui está tudo.

Três modos, em profundidade crescente: **Estante → Show → Livro oficial**. Mais a aba
**Personagens**. Cada modo é uma tela inteira, não um painel dentro do anterior.

Capturas em `telas/referencia/`. Dado em `dados-de-exemplo.json`.

---

## Os quatro princípios que explicam o resto

Estão escritos no próprio protótipo. Se algo abaixo parecer estranho, é por causa de um destes.

1. **Slot é a identidade, pessoa é camada.** O rótulo do slot (`1`, `4`, `&`, `M`) vive na cena
   e aparece em todos os quadros. Trocar quem faz **não redesenha nenhum quadro**.
2. **Quadros-chave, não frames.** Cada quadro existe por um motivo — posição inicial, splice,
   locação, saída. Uma cena tem de 2 a 4, não 15.
3. **O Livro do Dia é uma projeção.** A posição inicial de cada cena, mais a escalação da data,
   geram o Livro do Dia. Nenhum documento novo é escrito.
4. **Incompleto não é erro.** Posição sem titular, cena sem quadro, slot sem substituto: tudo
   salva. O sistema convida, não bloqueia.

E uma fronteira que não se cruza: **escalar por data acontece em Escalas. Aqui é o molde.**

---

## Modo 1 · Estante

Barra de filtros: busca por nome · local · estado (Todos, Publicados, Rascunhos) ·
**Favoritos** · ordenar.

Faixa de novidade no topo quando há shows alterados desde a última visita — some quando a
pessoa abre o show, não antes.

Cards agrupados **por local**, com ponto colorido, nome do local e contagem. Cada card:
capa com a inicial, estrela de favorito, etiqueta de estado, nome, tipo, responsável e
"alterado há". Grid de `minmax(252px,1fr)`.

Por perfil: MEM e DIR só veem publicados. SUP vê rascunho apenas do próprio local; os outros
locais aparecem como **somente leitura**.

---

## Modo 2 · Show

Cabeçalho: capa 132×96, etiqueta de estado, nome, descrição, responsável, e as ações
**Favorito** e **Abrir Livro oficial**.

Três blocos à esquerda e três cartões à direita.

**Links do Google Drive** — o acervo fica no Drive; o My ASA guarda os atalhos. Cada link tem
**tipo** (pasta principal, vídeo, música, planta…), **escopo** (show, cena, quadro) e **estado**
(inclusive *sem permissão de acesso*, verificado periodicamente). Filtros por tipo, e vazio
próprio: "Nenhum link deste tipo ainda."

**Informações gerais** — duração, contagem de cenas e quadros, elenco base, tempo de troca.

**Horários habituais** — *o horário mora aqui*. A Programação do local **seleciona** destes,
não digita. Mudar um horário aqui propaga para onde o show foi selecionado. É o mesmo dado das
`sessoes` do JSON: início, fim, chamada.

**Observações** — notas operacionais, cada uma com autor e data.

**Personagens do show** — diagnóstico, só leitura, somado das cenas: cada personagem com o modo
e um aviso quando a fila está vazia ou curta. A associação vem de **personagem ↔ show**, não só
de `characterId` na linha da cena.

**Histórico de versões** — quem, o quê, detalhe e quando.

---

## Modo 3 · Livro oficial

**É um modo próprio, não um painel.** Três colunas, mais uma barra no topo.

### Barra de publicação

`Livro oficial` · `v4 publicada` · `v5 em edição · rascunho` · … ·
`salvo automaticamente · 09:12` · **Histórico** · **Publicar alteração**.

Quem não edita vê "última alteração 09:12" e nenhum dos dois botões.

### Coluna esquerda — estrutura escrita (352px)

Lista de cenas. Cada uma: nome, `N slots · N quadros`, e um aviso quando há pendência.
A cena aberta expande em **grupos de slots**:

- **Backstage left** — slots `slots_bl`, na ordem
- **Backstage right** — slots `slots_br`, na ordem
- **Papéis nomeados** — os `personagens` da cena

Cada slot: chip do rótulo, nome de quem é titular, sub-linha, e um selo de criticidade.
Cada grupo tem **+ slot**; a lista tem **+ cena**.

Quando a cena pode crescer, um bloco tracejado: *"Esta cena pode crescer"*, com as sugestões
como fichas e a frase **"Convites, não erros. O livro salva incompleto."**

### Coluna central — a cena ativa

**Cabeçalho**: nome da cena, `N slots · N quadros-chave · <quadro atual>`, e à direita as
fichas dos papéis nomeados — chip rosa `#C2508F` com a inicial, fundo `#fdf3f9`.

**Linha de controle**: tipo do quadro atual, o momento em texto, e os **presets de palco**
(L, RET, QUAD, NONE) à direita.

**Linha de zonas** (só para quem edita): liga e desliga cada zona do palco, e **restaurar
posições**. Os rótulos de zona são **arrastáveis no mapa** — a posição fica salva por show e
por formato.

**O mapa principal** ocupa a área. Polígono do `mapa-palco.js`, com piso, aberturas, rótulos de
zona, e os **marcadores** — posição numerada em **roxo `#6C2BF2`**, papel nomeado em **rosa
`#C2508F`**. As coordenadas vêm de `buildMarkers(cena, tipoDoQuadro, palco)`; marcador também é
arrastável.

Quando o formato é `NONE`: em vez do mapa, um estado próprio — *"Este show não tem palco fixo.
O quadro-chave vira uma lista por zona. Ninguém precisa de coordenada — só de saber onde está."*
E as listas por zona embaixo.

**Ao clicar num marcador ou slot**, abre o cartão do slot sobre o mapa: rótulo, papel, onde
fica, **titular**, **substitutos numerados** com selo, **+ substituto** com seletor, e
observações. Vazio: "Sem substituto cadastrado". Rodapé: *"Escalar por data acontece em
Escalas. Aqui é o molde."*

**A tira de quadros-chave fica na base do mapa, na horizontal.** Cada quadro é um cartão
pequeno com uma **miniatura de pontos** (as posições daquele quadro), nome e momento. No fim,
**+ quadro-chave**. Legenda da tira: *"o mapa fala por número · a posição inicial alimenta o
Livro do Dia."*

**Ficha e materiais** — sanfona no rodapé da coluna: campos em grade e os arquivos com tipo e
escopo.

### Coluna direita — painel da ASA (314px, abre e fecha)

Intro, pergunta e resposta, lista de itens quando cabe, e **prévia antes de aplicar**:
fundo amarelo, *"prévia — nada foi salvo"*, com **Aplicar** e **Descartar**. Quem não edita vê
*"Seu perfil não edita este show — a ASA mostra, mas não aplica."*

Fichas de pergunta pronta no rodapé, e o campo "Pergunte sobre este show".

### Modal de publicar

560px. Cabeçalho com a mascote `aviso-importante`, `v5 substitui a v4`, o que mudou, escolha
de quem recebe, e o rodapé: *"Depois de publicar, o show fica marcado como Atualizado e você
pode ver quem recebeu e quem abriu."*

---

## Aba Personagens

Já especificada e construída. Lista por local, modo titular/rodízio, quem entra hoje com o
porquê, fila ordenada, aviso amarelo de fila curta, criar e editar com reordenação.

---

## O que é fácil errar

Cada um destes já aconteceu numa rodada.

| Erro | Correto |
|---|---|
| Livro oficial como painel dentro do show | modo próprio, três colunas, barra de publicação |
| Um mapa gigante, ou só miniaturas | mapa principal grande **+** tira horizontal de quadros na base |
| Marcadores todos roxos | posição é roxa, **papel nomeado é rosa `#C2508F`** |
| Marcadores distribuídos por conta própria | sempre `buildMarkers` do `mapa-palco.js` |
| Palco desenhado à mão | polígono do arquivo, formato vindo de `formato_palco` |
| Copiar o número, o eyebrow, o parágrafo, o "Ver como" | são moldura de documentação |
| Bloquear o salvamento quando falta algo | incompleto não é erro |
| Trocar pessoa e redesenhar o quadro | slot é a identidade; a pessoa é camada |

---

## Ordem de construção sugerida

1. Estante (pronta)
2. Aba Personagens (pronta)
3. Modo Show: Drive, informações, horários, observações, personagens, versões
4. Livro oficial — esqueleto de três colunas e a barra de publicação
5. Livro oficial — estrutura escrita e seleção de cena
6. Livro oficial — mapa com `mapa-palco.js`, presets e zonas
7. Livro oficial — tira de quadros e cartão de slot
8. Painel da ASA e modal de publicar

Dos passos 4 a 8, **mostre depois de cada um.** É o trecho mais denso do app e a volta fica
curta se a diferença for encontrada cedo.
