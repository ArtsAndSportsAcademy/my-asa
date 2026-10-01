# Livro oficial — inventário de interações

Fonte: `13 Shows.dc.html`. Este documento existe porque a porta perdeu comportamentos que
a ficha já tinha. **Tudo o que está aqui é obrigatório.** Nada aqui é enfeite: cada
interação existe porque alguém do elenco ou da supervisão precisa dela em cima da hora.

Regra geral: **todo botão visível ou faz o que promete, ou não existe.** Onde a ação
depende de algo ainda não construído, o botão fica desabilitado com o motivo no `title`
— nunca clicável sem efeito.

---

## 1 · Mapa do palco

### 1.1 Arrastar marcador — PERDIDO NA PORTA, RESTAURAR
O marcador é arrastável com o ponteiro.

- `pointerdown` inicia; **só vira arraste depois de 3 px de movimento**. Abaixo disso é
  clique curto e apenas seleciona o slot. Essa distinção é o que permite clicar e arrastar
  com o mesmo gesto, sem modo.
- Durante o arraste o cursor é `grabbing`, o marcador sobe de camada (`z-index`) e ganha
  halo roxo. Parado, o cursor é `grab`.
- A posição é gravada como **percentual da caixa do mapa**, limitada entre 4% e 96% para
  o marcador nunca encostar na borda.
- O override é gravado **por formato de palco + cena + quadro**. Mover alguém no quadro
  "Posição inicial" da Bandeiras não move ninguém em nenhum outro quadro, cena ou formato.
- `setPointerCapture` no alvo, para o arraste não se perder ao sair do elemento.

### 1.2 Arrastar o nome da zona — PERDIDO NA PORTA, RESTAURAR
Os rótulos (`BACKSTAGE LEFT`, `CENTRO`…) também se arrastam, pelo mesmo mecanismo.
O override é **por formato de palco** — a posição vale para todo show que usa aquele
formato, porque a zona é do palco, não da cena.

### 1.3 Restaurar posições
Botão de texto ao fim da fila de zonas. Descarta os overrides do quadro atual e devolve
todos os marcadores ao cálculo do `buildMarkers`. Não toca nos outros quadros.

### 1.4 Selecionar marcador
Clique curto seleciona o slot: anel amarelo `#F2C230` com halo, e o cartão do slot abre.
A seleção espelha na lista da esquerda, e vice-versa — clicar no slot da lista seleciona
o marcador no mapa.

### 1.5 Tamanho e alvo
Círculo de **24 px** (papel nomeado: **28 px**), com área clicável invisível de 44 px ao
redor. O desenho encolhe, o alvo não. Foi o marcador grande demais que vinha inflando o
palco inteiro.

### 1.6 Rótulo
O mapa fala por número — `BL 01`, `BR 03`, `*`, `Y`, `M` — como no livro impresso.
**O nome da pessoa aparece só no marcador selecionado**, e no cartão. Nunca em todos ao
mesmo tempo: vira sopa de letras.

### 1.7 Slot vago
Marcador com borda tracejada e sem preenchimento. Continua arrastável e clicável: a
posição existe mesmo sem ninguém nela.

### 1.8 Presets de palco
`L`, `RET`, `QUAD`, `NONE`. Trocar o formato **não move ninguém**: o marcador guarda
percentual da caixa envolvente, não do interior. `NONE` não desenha mapa nenhum.

### 1.9 Zonas ligam e desligam
Cada zona é um interruptor. Desligar esconde o rótulo, não apaga a posição de ninguém.

---

## 2 · Tira de quadros-chave

Horizontal, na base do mapa. Cada cartão traz a miniatura do palco com os pontos onde
eles realmente estão, o nome e o momento.

- Clique troca o quadro ativo no mapa.
- `+ Quadro-chave` ao fim da tira cria um quadro novo, com os mesmos marcadores do atual,
  tipo e momento em branco.
- Tipos: `inicial`, `splice`, `locacao`, `saida`. O quadro `inicial` de cada cena é o que
  alimenta o Livro do Dia.

---

## 3 · Estrutura escrita (coluna esquerda)

- Clique na cena abre a cena no centro.
- `+ Slot` em cada grupo (backstage left, backstage right, papéis nomeados) acrescenta um
  slot vago, já com rótulo na sequência (`BL 05`).
- O rótulo do slot é estável: trocar quem faz **não** renumera nem redesenha quadro algum.
- A rolagem acontece dentro da coluna, não na página.

---

## 4 · Cartão do slot

Abre ao selecionar. Compacto, posicionado para caber — se o marcador está à direita, o
cartão abre à esquerda. Traz rótulo, papel, titular, substitutos e a ação. A linha
"Escalar por data acontece em Escalas" é o limite de escopo: aqui se define o molde,
não o dia.

---

## 5 · Barra do Livro

Fixa no topo, nunca rola para fora.

- Breadcrumb `← Voltar ao show`.
- `Livro oficial` · `v1 publicada` · `v2 em edição · rascunho`.
- `Salvo automaticamente · hh:mm`.
- `Histórico` — abre as versões, com o que mudou em cada uma.
- `Publicar alteração` — abre o modal.

## 6 · Modal de publicar

Versão que substitui, o que mudou (linha por linha, com etiqueta), quem recebe a
notificação (públicos selecionáveis), mensagem pré-escrita e editável, "marcar como
importante", e o botão sólido `Publicar e notificar`.

## 7 · Painel da ASA

Fechado por padrão, só o avatar. Aberto, mostra a **prévia amarela antes de aplicar**:
a ASA nunca altera nada sem mostrar antes o que vai acontecer, e sem o usuário confirmar.

---

## 8 · Permissão

Quem não pode editar vê o mapa inteiro, mas sem arrastar: `pointer-events` desligado nos
marcadores e rótulos, cursor padrão, sem `+ Slot`, sem `+ Quadro-chave`, sem publicar.
O Livro é leitura para o elenco e bancada para supervisão e direção.
