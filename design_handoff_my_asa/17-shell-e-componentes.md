# Shell e gramática de componentes

`05-design-tokens.md` dá cor, tipografia e as peças soltas. Falta o que vem antes disso: **a
moldura que toda tela vive dentro** e os padrões que se repetem nas 23 telas. Este documento é
o que o front consulta primeiro — construir o shell certo uma vez economiza cada tela depois.

Referência viva: a tela `Estrutura My ASA` mostra a navegação inteira; `29 Estados de
carregamento, erro e vazio` mostra os estados; `30 Busca global`, a caixa de busca.

---

## 1 · A moldura

Três peças, e **nenhuma delas vem do servidor**: barra lateral, cabeçalho e o nome da pessoa
saem da sessão, que já está em memória. Desenhe as três imediatamente, antes de qualquer dado
chegar. É o que faz a tela nunca ficar em branco.

```
┌──────────┬─────────────────────────────────────────┐
│ barra    │ cabeçalho  (título · ações da tela)     │
│ lateral  ├─────────────────────────────────────────┤
│ 222px    │ [abas, quando a tela tem]               │
│          │ [barra de filtros, quando a tela tem]   │
│          ├─────────────────────────────────────────┤
│          │ conteúdo                                │
└──────────┴─────────────────────────────────────────┘
```

### Barra lateral — 222px, fixa

Fundo `linear-gradient(180deg,#1c1440,#241a52)`. De cima para baixo:

1. **Marca** — asa + "My ASA", 16px de respiro em volta
2. **Busca** — a caixa de `30 Busca global`, sempre presente
3. **Grupos de navegação** — etiqueta em JetBrains Mono 9px maiúscula `#7d72a8`, itens em 12px
4. **Rodapé com a pessoa** — avatar 30px, nome, e o perfil em etiqueta maiúscula

Item ativo: `background: rgba(255,255,255,.13)`, texto `#fff`, peso 600.
Item inativo: texto `#c6bde6`, sem fundo.
Raio 9px, padding `7px 10px`.

**Os grupos são fixos e sempre na mesma ordem** — quem usa todo dia decora a posição:

| Grupo | Itens |
|---|---|
| Operação | Meu Dia · Escalas · Livro do Dia · Shows · Check-in · Folgas · Agenda |

**Shows tem duas abas**: Shows · Personagens. As duas são configuração de palco e as duas
filtram por local. Personagens não é item de lateral — é usado uma vez na configuração, e
personagem pertence ao **local**, não a um show (Astrid está em dois shows do Snowland). Por
isso a aba fica no nível da seção, nunca dentro de um show.

**A biblioteca de formações não fica em Shows** — ela mora no **Livro do Dia**, com a navegação
show → cena → quantidade, porque é ali que se consulta enquanto se resolve o dia. E formação é
variante de uma cena, não item de uma lista geral.

**Hora nunca faz parte do nome do show.** "Yeti" é um show com duas sessões; a hora vem da
Sessão (Bloco 2, início e fim). A escala fala "YETI 16:00" para distinguir uma sessão da outra —
isso é vocabulário de escala, não nome de entidade.
| Pessoas | Pessoas · Áreas · Locais · Responsabilidades |
| Comunicação | Mural · Mensagens · Biblioteca · Reconhecimentos |
| Gestão | Painel · Registro |

**Item que o perfil não alcança não aparece** — não aparece desabilitado. Menu cinza conta o
que existe do outro lado, e é o mesmo vazamento da busca. O elenco vê cinco itens, não quinze
com dez apagados.

### Cabeçalho — 12px 20px, fundo branco, borda embaixo

Título da tela em Outfit 17px/600 à esquerda; ações à direita. **Máximo uma ação primária
sólida por tela** — o resto é secundário. Se a tela está carregando, o indicador vai aqui, não
no meio do conteúdo.

---

## 2 · Três arquétipos de página

Toda tela é um destes. Escolha um e não invente um quarto.

### A · Lista com filtros
*Pessoas, Locais, Áreas, Biblioteca, Responsabilidades, Shows*

Barra de filtros (chips) abaixo do cabeçalho, lista em cartão único com linhas divididas por
`#f5f2fa`. Vazio aqui é quase sempre **vazio por filtro** — mostre o total sem filtro e ofereça
tirar o filtro mais restritivo.

### B · Grade temporal
*Escalas, Livro do Dia, Agenda, Folgas*

Seletor de data/período no topo, grade com coluna fixa à esquerda (pessoa ou hora) e colunas de
tempo. É a família mais densa do app: respeite o piso de **12px** e os **44px** de alvo mesmo
apertado — se não couber, corte coluna, não tamanho.

### C · Painel de cartões
*Meu Dia, Painel, Check-in, Perfil*

Grid de cartões `minmax(min(100%,330px),1fr)` com gap 14px. **Cada cartão carrega e falha
sozinho** — um painel quebrado não derruba o dia inteiro.

---

## 3 · Componentes que se repetem

Estes aparecem em cinco telas ou mais. Construa uma vez.

### Linha de pessoa
Avatar circular (26px em grade, 38px em lista, 42px no celular) + nome em 14–15px/700 + **uma
segunda linha de contexto** em 12,5px `#6b6482`.

**O nome na tela é o `nome_de_exibicao`** — como a pessoa escolheu ser chamada, não o nome
completo do cadastro. A casa fala Carol, Dani, Daia, Victor M.; é esse nome que aparece.
O nome completo aparece em três lugares só: ficha da pessoa, cadastro, e Registro de auditoria.

A segunda linha não é enfeite: em quarenta pessoas há duas Marielas possíveis e um Victor M.
que não é o Victor Oliveira. O contexto é sempre **área · local · e o que essa pessoa está
fazendo agora** — e é ele que desempata nome repetido, não uma inicial de sobrenome colada
no fim.

### Bloco de horário
Usado na Escala e no Livro do Dia. Hora em JetBrains Mono, nome do bloco em Manrope 600.
Os nomes vêm do vocabulário real (`06-vocabulario-e-elenco.md`) — TREINO GELO, ACQUASHOW DUO,
BOAS-VINDAS. Não traduza, não abrevie, não invente.

### Chip de área e local
Usado como filtro e como marcador. Ativo: borda da cor, fundo `<cor>14`, texto na tinta.
Inativo: borda `#e6e1f2`, fundo branco, texto `#6b6482`.

**Área e local são dois chips, nunca um.** Bailarinos existe em Snowland e em Acquamotion com
supervisores diferentes — juntar os dois num chip só apaga a distinção que o Bloco 6 acabou de
construir no banco.

### Etiqueta de estado
JetBrains Mono 10,5px maiúscula, `padding:3px 8px`, raio 6px, cores semânticas.
Publicado, Rascunho, Aberta, Resolvida, Não carregou.

### Faixa de aviso no topo do conteúdo
Uma linha, cor semântica, sem raio, largura total. Para: sem conexão (erro), conflito de
horário (atenção), escala publicada (positivo). Nunca empilhe duas — se houver duas coisas a
dizer, a mais grave ganha.

### Abas
Só quando a tela tem **duas faces do mesmo objeto**: Escalas tem Programação e Escala. Não use
aba para navegar entre coisas diferentes — isso é a barra lateral.
Ativa: peso 700, borda inferior 2px roxa. Inativa: 600, `#6b6482`.

---

## 4 · Os dois padrões da decisão 5

Decidido em 17/09. Estes dois são mecanismo compartilhado, não código por tela.

### Faixa de desfazer
A ação acontece. Faixa embaixo, 10 segundos, com *Desfazer*:

```
┌──────────────────────────────────────────────┐
│ Formação desativada          Desfazer    ×   │
└──────────────────────────────────────────────┘
```
Fundo `#1c1440`, texto branco, raio 14px, canto inferior. Alvo de 44px no *Desfazer*.

**Se a ação manda notificação, o envio espera os mesmos 10 segundos.** Desfez, o aviso nunca
sai. Não desfez, sai ao fim da janela.

Usam: desativar formação, arquivar documento, remover de grupo, negar folga.

### Diálogo de motivo
Para o que não tem conserto. **Uma tela só** — não "tem certeza?" seguido de "agora escreva o
motivo". O motivo *é* a confirmação:

```
Desligar Sofia do elenco

Ela perde o acesso agora e sai dos grupos. O histórico dela fica.

Por quê?  [___________________________]

               [ Cancelar ]  [ Desligar ]
```

Botão de confirmar desabilitado enquanto o motivo estiver vazio — **e espaço em branco conta
como vazio**. Usam: cancelar aviso publicado, desligar pessoa, trocar perfil, reabrir local.

---

## 5 · O celular

Não é a versão web encolhida. Muda a moldura inteira.

- **Abas no rodapé, cinco**: Meu Dia · Escala · Check-in · Avisos · Mais. Elas **nunca somem**,
  nem em erro de tela cheia — nenhuma tela pode ser sem saída.
- **Cabeçalho** com voltar à esquerda e título; sem barra lateral.
- **Alvos de 48px**, não 44. Uma mão, luva de figurino, pressa, antes de entrar em cena.
- **Busca ocupa a tela toda** quando aberta — caixa flutuante com teclado aberto não deixa
  espaço para resultado.
- **Corpo de 14–15px**, não 13. O celular é lido em pé, com pouca luz.

O elenco só usa o celular. Se uma tela ficar boa no computador e ruim no celular, ela está
ruim — são 40 pessoas no celular e 4 no computador.

---

## 6 · Responsivo

Mesma rota, mesmo conteúdo, layout que reflui. Dois pontos de virada:

- **abaixo de 1100px** — barra lateral vira gaveta; grade temporal rola na horizontal com a
  primeira coluna fixa
- **abaixo de 720px** — moldura do celular: abas no rodapé, cabeçalho simples

Nada de largura fixa em px fora das grades temporais. `minmax(0,1fr)` nas colunas, `max-width`
em vez de `width`, e nenhum `nowrap` em caixa que contém texto.

---

## 7 · Ordem de construir o front

Não são as 23 telas, mas também não são quatro. A ordem não é por importância — é por
**dependência de dado**: o Livro do Dia é cópia do Livro do Show numa data, a Escala nasce da
Programação e só pode escalar quem não está de folga, e não há quem escalar sem Pessoas,
Áreas, Locais e as filas de Personagem montadas.

Puxando esse fio até o fim, o piloto precisa de **quinze telas**. Seis ficam para depois.

### Fase 1 — configuração: a Barbara preenche antes do piloto começar

1. **Shell** — barra lateral, cabeçalho, busca, os dois padrões da decisão 5, e os estados de
   carregamento/erro/vazio. Não é tela; é o que todas as telas usam.
2. **01 Entrada** — login, primeiro acesso, e o passo de instalar na tela de início (seção C2).
3. **07 Pessoas · 08 Áreas · 06 Locais** (arquétipo A) — o elenco existe aqui. Conta é criada
   pela Administração; sem esta tela não há ninguém para escalar. Locais carrega o par
   **área + local** que o Bloco 6 construiu: Bailarinos tem Victor em Snowland e Stephani em
   Acquamotion.
4. **04 Personagens e formações** (A) — personagens por local, modo titular ou rodízio, e as
   **filas montadas**. É o que faz o Livro do Dia nascer resolvido.
5. **13 Shows / Livro do Show** (A + detalhe) — cenas, posições, personagens, e as **sessões
   com início e fim**. Origem do Livro do Dia e entrada do detector de conflito do Bloco 3.
   Sem `fim`, o Bloco 3 não tem intervalo para comparar.
6. **18 Folgas** (B) — turmas do mês, com "repetir a configuração do mês anterior". A geração
   da escala consulta isto: quem está de folga não entra, e a lacuna *"ninguém elegível, as três
   da fila estão de folga"* nasce daqui.
7. **15 Escalas · aba Programação** (B) — o molde por local e dia da semana. Tempo gasto aqui
   economiza a semana inteira.

Estas são **configuração**: uso concentrado numa tarde, por uma pessoa, no computador. Podem
ser mais densas e menos gentis que as de uso diário — quem preenche está sentado, com tempo, e
preenche uma vez.

### Fase 2 — uso diário: o que a operação toca toda manhã

8. **17 Meu Dia** (C) e **19 Check-in** (C) — as duas que o elenco inteiro usa no dia 1, no
   celular. São as que decidem se o app pega.
9. **15 Escalas · aba Escala** (B) e **14 Livro do Dia** (B) — as duas da supervisão, onde está
   o ganho de tempo que o piloto vai medir.
10. **20 Agenda** (B) — reunião e ensaio que não são bloco de escala precisam de lugar. E é
    onde o elenco **propõe sem convocar**: a proposta vira compromisso quando a supervisão
    libera.
11. **22 Mural** (A) e **28 Perfil** (C) — o aviso com ciente é metade do valor do push; o
    Perfil guarda senha e preferência de notificação.

### As seis que ficam para depois

Agenda saiu desta lista a pedido da operação. Restam: **23 Mensagens · 24 Biblioteca ·
25 Reconhecimentos · 16 Painel · 10 Responsabilidades e Tarefas · 27 Assistente ASA.**

Não é que sejam dispensáveis — é que nenhuma é dependência de outra, e o Painel em especial lê
dados que na semana 1 ainda não existem. **Cada tela construída antes do piloto é uma tela para
refazer depois** que a primeira semana ensinar algo. Amplie por **área**, não por
funcionalidade.

> **Não tente semear o Livro do Show ou as filas de personagem direto no banco para pular a
> fase 1.** Funciona até a primeira cena errada — e aí a supervisão fica parada esperando
> alguém mexer no banco, no meio de um dia de show. A fase 1 é o que torna o piloto autônomo.

Uma regra que economiza retrabalho em todas as fases: **construa o estado vazio e o de erro
junto com a tela**, não depois. Na primeira semana não há dado nenhum e a rede do camarim é
ruim — vazio e erro são a primeira impressão de quarenta pessoas que ainda não decidiram se
confiam no app.
