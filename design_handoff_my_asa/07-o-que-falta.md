# O que o desenho ainda não resolve

Auditoria do protótipo. Corrigir **na implementação** — não são defeitos a reproduzir.

## Estoura no primeiro dia

**Tipografia pequena demais.** 479 ocorrências de texto abaixo de 11px; a Escala chega a 7,5px.
Piso na implementação: **12px** para texto que se lê, 11px só para etiqueta em maiúsculas.

**Alvos de toque pequenos.** 8 telas com botões de 32 a 38px. Mínimo **44px**.

**O app vive num dia congelado.** 23 datas fixas no código ("12 set", "1 out"). Nada é
calculado a partir de hoje. "Amanhã", "esta semana", "vence em 3 dias" são texto escrito à mão.
Na implementação, tudo isso é cálculo.

## Aparece na primeira semana

**Nenhum estado de carregamento.** Zero no app inteiro — todo dado é instantâneo porque está no
código. Com servidor real existe espera, e sem indicação a pessoa clica de novo.

**Erro tratado em 1 tela de 17.** O que acontece quando o check-in falha, a foto não sobe, a
escala não salva? Não está desenhado.

**Confirmação faltando nas ações irreversíveis**: desligar pessoa, cancelar aviso publicado,
negar folga, reabrir local, apagar formação.

Sugestão em aberto para a dona do produto: confirmação "tem certeza" **ou** ação imediata com
"desfazer" por alguns segundos. A segunda é melhor para quem usa o dia inteiro; a primeira é
mais segura para o que não dá para desfazer, como aviso que já foi para o celular de todos.

## Aparece quando alguém adoecer

**Conflito de personagem: detecção parcial.** Auditoria do código do piloto encontrou detecção
genérica por data, mas **sem comparar horários sobrepostos** e sem o alerta nos dois momentos
definidos (ao montar o show e ao gerar o Livro do Dia). No desenho, não existe em tela nenhuma.

**Rodízio conta errado no código do piloto.** Ele incrementa por linha vencedora, podendo somar
duas vezes no mesmo dia. O correto é 1 por pessoa e por dia — ver `01-modelo-de-dados.md`.
É a divergência mais grave encontrada, porque corrompe o rodízio em silêncio.

## Aparece devagar, como cansaço

**O app é um arquipélago.** Toda tela liga só para a ASA e para o Perfil. A única ligação real
é Escalas → Livro do Dia. Faltam: Pessoas → Áreas, Folgas → Escalas, Shows → Livro do Dia,
Check-in → Pessoas.

**Perfis com buracos.** Reconhecimentos não trata o elenco — justamente quem ele serve.
Locais não trata Direção nem Supervisão. Mensagens ignora Direção e Supervisão.
Biblioteca e ASA ignoram Direção.

**Acessibilidade quase inexistente.** Descrição para leitor de tela em 2 de 17 telas.

## Diferenças de medida entre as telas

8 telas foram desenhadas em alturas inventadas (620 a 960px) em vez do quadro real de
1920×1080: Locais, Pessoas, Responsabilidades, Shows, Livro do Dia, Escalas, Folgas e Agenda.
Elas mostram **menos conteúdo do que caberia numa tela real** — ao implementar, esperar espaço
sobrando e preencher com o que a tela pede.

As demais já estão no quadro real: Painel, Meu Dia, Mural, Mensagens, Biblioteca,
Reconhecimentos, ASA, Perfil e Check-in.

## Nada disso existe — é construção, não desenho

Banco de dados. Login validado no servidor. Sessão que expira. Permissão checada no servidor.
Push. Regra de escrita concorrente no Livro do Dia. Busca global (hoje a caixa "Buscar ou
perguntar à ASA" só abre o chat; buscar pessoa, show, documento ou data não existe).

**Instalável na tela de início (PWA)** — ícone, nome "My ASA", abertura em tela cheia. Não é
capricho: no iPhone a notificação push **só funciona depois de instalado na tela de início**.
Como a notificação é metade do valor do app, instalar vira passo obrigatório do primeiro
acesso, não sugestão — e o procedimento difere entre iPhone e Android.

**Biblioteca de formações**: a auditoria do piloto não encontrou a biblioteca nem a sugestão
por quantidade de pessoas. Existe apenas no desenho.

## Resolvido — confusão entre Direção e Administração

São **dois perfis distintos** (ver `02-perfis-e-permissoes.md`). Direção (Cris Garcia) é
**leitura** em quase tudo, inclusive em 13 Shows — Administração (Barbara Sorroche) é quem tem
**total**. Uma varredura testou "Direção deveria editar tudo" partindo de uma instrução minha
errada — não era bug do código. Confirmado: `canManageShowBook` já bloqueava DIR, e `canManage`
do front já era `adm || sup`. **Nenhuma mudança de código foi necessária.**

## Escopo de Shows por área ainda não modelado

`?amostra=1` só tem um interruptor global de perfil (`canManage = true/false`) — não existe
"Deborah" nem escopo por área (Patinadores/Bailarinos/Produção) na ferramenta de revisão.
No servidor, `canViewShowBook`/`canManageShowBook` restringem por `operation`, e
`operationsTable.locations` é um array — não está confirmado se uma operação corresponde a
uma área (ex.: Patinadores) ou é mais ampla (várias áreas, um só piloto). Enquanto isso não
for esclarecido, escopo de Shows por supervisor depende de `show.responsibleId`, e não há UI
confirmada para atribuir esse responsável. Precisa de decisão de modelo de dados antes de
demonstrar "Deborah só vê Patinadores" em Shows.

## Achado grave — só Shows e Perfil têm conteúdo real hoje

`App.tsx` já roteia tudo para `ShellFoundation`; as ~50 rotas antigas (`/admin/daily-book`,
`/supervisor/daily-book`, `/admin/show-book`...) são código morto, inalcançável. Todo item de
menu além de Shows e Perfil (Livro do Dia, Escalas, Pessoas, Áreas, Check-in, Folgas, Agenda,
Mural...) renderiza `shell-foundation.tsx` — um placeholder de 4 botões de estado
(Carregando/Erro/Vazio/409), sem dado nem comportamento. Não é "ainda não portado para o padrão
novo": é que a tela ainda não existe na superfície navegável nova. **Shows está formalmente
encerrado para a varredura de perfis** — o que falta testar exige escopo por área (bloqueado,
ver acima) ou construir a tela real (fora do escopo de varredura).

## 14 Livro do Dia — portada, com duas simplificações a fechar

Portada para o `ShellFoundation` (22/09/2026), com `pattern-diff` real, `reopen` só ADM com
motivo, e os quatro perfis testados em `?amostra=1`. Ficaram duas simplificações:

1. **Biblioteca de formações sem cena.** Agrupa show → quantidade, porque `formations` não tem
   `sceneId`. A referência agrupa show → cena → quantidade. Decisão: **adicionar `sceneId`
   (opcional)** a `formations`: formação é de uma cena, não do show inteiro.
2. **Sem "aplicar só hoje".** A aba Formações está só para consulta; só "Guardar no padrão"
   grava. Isso contradiz o princípio da tela 14: o Livro do Dia é editável **sem afetar o
   padrão**. Decisão: **implementar "aplicar só hoje"** (grava na instância do dia, com
   Registro); "Guardar no padrão" continua sendo a ação separada e explícita.

Aceito como está: layout responsivo único, sem moldura de celular (a moldura do `.dc.html` é
documentação). Falta ainda o teste de ponta a ponta com login real, fora de `?amostra=1`.

## Mapa de palco — tamanho único (decidido 22/09/2026)

O mapa de palco é um componente só, igual em 13 Shows e 14 Livro do Dia: **quadrado
(`aspect-ratio: 1/1`), ocupando a largura da coluna até 760px** (`width: 100%; max-width: 760px`).
A Cris pediu mapa grande — ele é a peça central da tela, não pode ficar pequeno. (Antes era
560px; foi aumentado em 22/09/2026, e o `14 Livro do Dia.dc.html` já está com 760px.)
Se a altura da tela não comportar 760px, o mapa encolhe pela altura disponível — nunca abaixo
de 560px.

**Correção (22/09/2026):** a regra é **mesma largura** nas duas telas (760px). A **altura segue a
proporção do palco** definida no `mapa-palco.js` (o palco em L é mais alto que largo). "Quadrado"
era só para não distorcer — respeitar a proporção real do palco cumpre isso melhor.

**Ajuste (23/09/2026):** o mapa **cabe na tela sem rolar**. Altura máxima = altura visível da
área de conteúdo; a largura é calculada pela proporção do palco (`ratio` do `mapa-palco.js`),
até 760px. Os 267px vazios de cada lado somem: a coluna do mapa encolhe até a largura do
mapa, e a coluna do lado (cena, "Removido hoje", ações) fica com o espaço que sobra.

**Decidido (23/09/2026):** no Shows a coluna do mapa também encolhe até a largura do mapa; o
painel da ASA fica com o espaço que sobra. Mesma regra nas duas telas. No Shows, cada marcador
mostra o **código do slot** (BL 01, BR 03…), e os lugares de personagem mostram o **nome do
personagem**. Bolinha sem rótulo não serve.

**ASA aberta no Shows (23/09/2026):** abrir o painel da ASA **não encolhe o mapa**. O painel
abre por cima, como gaveta à direita (360px, sombra, fecha no ×), e o mapa fica do mesmo
tamanho. Fechada, a ASA volta a ser a coluna estreita com o espaço que sobra.

## 15 Escalas — decisões antes de construir (23/09/2026)

1. **Unidade:** uma Escala por local por dia, com todas as áreas dentro e uma publicação só.
2. **Programação:** entidade nova, `programacoes`, com vigência (Natal, Normal, Baixa…), local e
   dias da semana. Cada bloco tem a regra de quem entra: todos, ninguém, área, grupo, pessoas,
   ou show→Livro. Não estender `recurring_activities`.
3. **Quem publica:** a Supervisão **marca a parte da área dela como pronta**, e só dentro da
   área dela. A **Administração publica o dia**, manualmente no lançamento (decisão 6). O
   rodapé mostra quais áreas já estão prontas e quais faltam.
4. **Painel da ASA:** fica fora desta passada. Não desenhar um painel falso.
5. **Dado de exemplo:** atribuir por área, conforme a escala real. TREINO GELO → Patinadores.
   ENSAIO Bailarinos → Bailarinos. Coluna da Produção → "PRODUÇÃO". YETI/NANOOK → quem já está
   nos Livros de personagem. Bloco sem regra clara fica vazio e sinalizado, nunca inventado.
6. **Abas:** duas, Escala e Programação. As abas "Livros do dia", "Publicação" e "Minha
   escala" da Supervisão saem da referência. Os links vão para a 14.

## 14 Livro do Dia — duas correções de comportamento (22/09/2026)

1. **"Guardar no padrão" guarda a formação de HOJE**, já ajustada (ex.: Molduras com 12), como
   nova variante na Biblioteca daquela cena. Guardar a versão do Livro do Show não tem sentido:
   a biblioteca existe para reaproveitar o desfalque que se repete. Exige mudança no backend.
2. **"Aplicar só hoje" leva as pessoas junto.** Quem já estava escalado numa posição que continua
   existindo na formação nova (mesmo código de slot) continua nela. Só fica "vago" o que não
   tem correspondência. Nunca escala alguém que não estava escalado no dia.

Aceitos: texto mínimo 12px (11px em rótulo maiúsculo), área de toque invisível de 44/48px,
chão com grade do Shows, e os dois textos reescritos para não prometer o que não acontece.
O `mapa-palco.js` da raiz do projeto é o canônico — a versão embutida no `.dc.html` é antiga. As coordenadas do `mapa-palco.js` são em %, então só o quadrado
mantém o desenho do palco sem distorção. O Shows deixa a altura "do espaço que sobra" e adota
essa medida.

Print de comparação usa dado real: **Musical do Natal → Molduras** (o "Patinação — Inverno
2026" do `.dc.html` é dado de demonstração, não existe em `dados-de-exemplo.json`).

## Falta na tela 13 Shows

O alerta de conflito de horário (decisão nº 4 em `09-decisoes-confirmadas.md`) só está
desenhado no momento de gerar o Livro do Dia (tela 14). Falta o segundo momento exigido pela
regra: **ao montar o show**, dentro de `13 Shows.dc.html` (Livro oficial) — mesma faixa de
aviso, mesmo texto "alerta — não bloqueia a publicação".

## Decisões que precisam da Direção

Onde hospedar · quanto custa por mês · quem atende quando cai num domingo de show ·
quanto tempo os dados ficam guardados · quem é o responsável nomeado pelos dados.

**Sobre cair no domingo**: um app de 40 pessoas não sustenta plantão. Desenhe para a falha —
a escala do dia precisa existir fora do app (impressa no camarim, ou no grupo na véspera).
O app é onde a escala **nasce**, não o único lugar onde ela **vive**.
