# Como portar uma tela

Leia isto **uma vez**, antes da primeira tela. Vale para todas — cada pedido depois é só
"porte o Grupo A", sem repetir nada daqui.

---

## A regra

**Os arquivos `.dc.html` deste pacote não são especificação. São a tela pronta.**

Eles abrem direto no navegador: HTML com estilo inline, sem build, sem instalar nada. Abra
`design_handoff_my_asa/telas/13 Shows.dc.html` e você vê exatamente o que o app tem que
parecer.

Portanto: **abra o arquivo, ponha lado a lado com a sua tela, e copie.** Não leia o código
como se fosse uma descrição para reinterpretar — os valores estão todos ali, inline. Não
aproxime cor, espaçamento ou tamanho a olho.

---

## O que é para copiar e o que é para escrever

| Copie do arquivo | Escreva você |
|---|---|
| estrutura do HTML e hierarquia | busca na API e estado |
| estilos inline: cor, espaçamento, raio, sombra, tipografia | roteamento |
| os textos e microcópias | permissão por perfil (checada no servidor) |
| os estados: carregando, erro, vazio | salvar, 409, desfazer |
| arquivos utilitários prontos (`mapa-palco.js`) | validação e formulários reais |

Regra prática: **se é aparência, é cópia. Se é comportamento, é seu.**

Os protótipos têm dado de mentira e lógica de demonstração embutidos — isso você descarta.
A camada visual, não.

### `mapa-palco.js` é para copiar, não recriar

Ele desenha o palco como **polígono**, com os marcadores nas coordenadas certas, e cada show
tem o seu formato. Copie o arquivo para os assets do front e use as funções dele. Caixa
tracejada com bolinha numerada não é o mapa de palco.

---

## O que NÃO copiar dos arquivos

Cada `.dc.html` é uma ficha de documentação que **mostra** a tela dentro de uma página
explicativa. Essa moldura não vai para o app:

- o número e o eyebrow (`13 · biblioteca de estudo e palco`)
- o título display e o parágrafo que explica o que a tela é
- a barra "Ver como" do topo (é para revisar o desenho)
- a legenda "Web · 1920 × 1080 · exibido a 70%" e o `transform: scale(0.7)`

**O que você quer é o conteúdo do quadro de 1920×1080 lá dentro** — a barra lateral, o
cabeçalho e o miolo. O resto é papel de embrulho.

Vale a regra geral: **texto que explica o que a tela é pertence ao pacote, não ao produto.**
A Barbara vai abrir cada tela centenas de vezes; ela não precisa reler o que é uma estante.

---

## Dado de exemplo

Sempre de `design_handoff_my_asa/dados-de-exemplo.json`. Nunca escrito à mão.

Três contratos que o arquivo carrega:

- **A hora é da Sessão, nunca do nome do show.** "Yeti" é um show com três sessões.
- **Bloco de um local nunca aparece no outro.** TREINO GELO é Snowland; ACQUASHOW é Acquamotion.
- **Não invente nome** — nem de pessoa, nem de personagem, nem sobrenome. Se precisar de um
  caso que o arquivo não cobre, pergunte antes.

---

## Conferência antes de mostrar

Rode isto sozinho. São os erros que mais apareceram; achá-los você mesmo economiza uma volta
inteira.

**Fidelidade**
- [ ] Abri o `.dc.html` no navegador e comparei lado a lado?
- [ ] Cores, espaçamentos e tamanhos são os do arquivo, não aproximações?
- [ ] Tirei a moldura de especificação (número, eyebrow, parágrafo, "Ver como")?

**Dado**
- [ ] Todo nome de pessoa, personagem, show e bloco sai do JSON?
- [ ] Área, local e bloco combinam entre si em todo exemplo?
- [ ] Nenhum nome inventado?

**Comportamento**
- [ ] Abri um editor e salvei sem mexer em nada — algo mudou? **Não pode.**
- [ ] A tela tem carregando, erro e vazio? (`29 Estados de carregamento, erro e vazio`)
- [ ] Permissão checada no servidor, não escondida na tela?
- [ ] Item que o perfil não alcança **não aparece** — nem desabilitado?

**Medidas**
- [ ] Nenhum texto abaixo de 12px?
- [ ] Nenhum alvo de toque abaixo de 44px no computador, 48px no celular?
- [ ] Reflui abaixo de 1100px e abaixo de 720px?

**Ao entregar**: diga o que ficou diferente do arquivo e por quê. Diferença consciente é
decisão; diferença não percebida é defeito.

---

## Ordem e agrupamento

Telas do mesmo arquétipo se portam juntas — os mesmos erros aparecem nas três de uma vez e se
corrigem numa volta só.

| Grupo | Telas | Arquétipo |
|---|---|---|
| **A** | 07 Pessoas · 08 Áreas · 06 Locais | lista com filtros |
| **B** | 01 Entrada · 28 Perfil | conta |
| **C** | 17 Meu Dia · 19 Check-in | cartões, celular primeiro |
| **D1** | 15 Escalas | grade temporal |
| **D2** | 14 Livro do Dia | grade temporal (inclui a biblioteca de formações) |
| **E** | 18 Folgas · 20 Agenda | grade de mês |
| **F** | 22 Mural | lista |

D1 e D2 vão sozinhas: são as duas mais pesadas e as que o piloto mede.

**Fase 1 primeiro** (configuração, a Barbara preenche antes do piloto): B, A, Personagens,
13 Shows, E-Folgas, Programação. **Fase 2 depois** (uso diário): C, D1, D2, E-Agenda, F.
Detalhe em `17-shell-e-componentes.md`.
