# Plano de construção: Escala mais fácil, mais limpa e mais bonita

Este é o plano **para construir** (o outro, `plano-escala-mais-facil-para-a-babi.md`, é para a Babi decidir regras). Nada daqui
foi feito no app ainda. Regra da casa: uma etapa por vez, um commit por etapa, e eu só digo que uma tela está pronta depois de
ver tudo (quatro perfis, 375 px e 1360 px, estados, janelas, medidas).

## O que guia tudo

- **Menos cliques.** Toda tarefa comum tem de caber em 1 a 3 toques. Meta de hoje para amanhã: tirar uma pessoa (hoje 2 telas e
  uma lista de 25) em 1 toque no bloco; atividade para 15 pessoas (hoje ~21 cliques) em 4; criar bloco da Programação para 5 dias
  (hoje ~10) em 5.
- **Mais limpo.** Menos camadas antes do dia, menos "—", menos texto pequeno. O caminho comum primeiro, o raro um nível abaixo.
- **Mais bonito e mais intuitivo (Apple Design).** Cor forte por tipo com o nome escrito, régua de horário, faixas emendadas,
  toque de 44 px, texto de 12 px ou mais, janelas com confirmar e cancelar sempre à vista, desfazer em tudo, resposta na hora.
- **Não recriar nada.** O conceito está certo: Programação gera o dia e o Livro, a Escala tira a folga, o Livro resolve as vagas
  sozinho, a Administração publica tudo. Mudamos o jeito de mexer.

## Como vocês trabalham de verdade: o dia seguinte

A escala e o Livro de **terça são feitos e publicados na noite de segunda**. Então o dia que se prepara é quase sempre o seguinte.
Isso vira regra de tela em toda etapa:

- **Abre no dia certo, por horário configurável.** A Administração define, **por local**, a partir de que horas a Escala passa a
  abrir no dia seguinte (padrão sugerido: 18:00) e a partir de que horas volta a abrir em hoje (padrão sugerido: 05:00). Vale o
  horário do local, não o do aparelho. "Hoje | Amanhã" e o calendário continuam à mão. Quem muda é só a Administração (a Direção
  vê, Supervisão e Elenco não veem), com **Registro** do valor antigo e do novo, na tela de Locais.
- **A tela diz em que dia está:** "Terça, 28 (amanhã) · rascunho", e o botão diz "Publicar a escala de terça". Evita publicar o
  dia errado.
- **O Livro abre no mesmo dia** (Etapa 0 leva a data do dia preparado). O texto da tela acompanha o contexto: nada de "hoje"
  escrito enquanto se vê amanhã.
- **Depois de publicar na noite anterior, mudança no próprio dia espera a republicação**, a Administração é avisada, e o Elenco só
  vê a mudança quando for republicada. O Elenco recebe "sua escala de amanhã saiu" na noite da publicação.
- A folga de amanhã já é conhecida na noite anterior; o Livro nasce com ela descontada. Mudança de última hora (atestado de
  manhã) é o caso que sobra para ajustar no próprio dia.
## O que já existe e NÃO se refaz (conferido no código)

- Hoje / Amanhã / Calendário; aviso "blocos sem ninguém"; choque com "Tirar de…" e "Mudar horário"; desfazer da Programação;
  barra de baixo com Gerar / Pronta / Publicar; "pronta" por área (`escala_areas_prontas`).
- **"Publicar tudo" já é verdade no servidor:** `publicarOuRepublicar` (`routes/escalas.ts:637`) publica a Escala **e os Livros
  do Dia na mesma transação**, com Registro, e só se todas as áreas estiverem prontas. A Escala não precisa de regra nova aqui;
  falta só o botão dizer isso e pedir confirmação com um resumo.
- O Livro do Dia já navega por dias, já mostra "o que mudou" (`pattern-diff`, `delta`) e "sem ninguém escalado hoje".

## Estratégia técnica

- **Ramo:** novo, a partir do topo de `codex/myasa-novo` (hoje `acd003b`). O ramo `codex/escala-mais-facil` só tem os documentos.
  Nunca merge na `main`. Nada vai ao GitHub nem a produção sem o "pode enviar" de quem constrói o app.
- **`escalas.tsx` tem 1.615 linhas e quase todo o estilo dentro do JSX** (`escalas.css` tem 66 linhas). Por isso: **peças novas
  em arquivos novos** (`src/components/escala/…` com um CSS próprio com variáveis de cor e tamanho) e o `escalas.tsx` só liga as
  peças. Assim o redesenho não vira uma edição de 1.600 linhas e outras sessões não esbarram.
- **Não tocar** em `print-day.tsx`, em `AjusteCelulaDialog` (`escalas.tsx:850`) e no trecho das vagas por personagem. O
  `livro-do-dia.tsx` só entra com autorização, em commits só dele (ver Etapa 0 e Etapa 4).
- **Cor por tipo:** hoje `toneOf` (`escalas.tsx:88`) adivinha pelo nome (show, almoço, treino/ensaio viram "aula", o resto
  "prep"). Passa a ler o **Tipo gravado**, e cai no palpite só quando não há tipo. Nada quebra onde ninguém escolheu.
- **Migrações:** a 0081 já foi tomada por outra sessão (`0081_pasta_do_show`, solta). As nossas começam na **0082** (horário da virada), seguida da **0083** (conferido) e da **0084** (tipos), cada uma
  com rollback em `lib/db/drizzle/rollback/` e registro em `meta/_journal.json` (que outra sessão também mexe: combinar a ordem
  de commits). **Só no banco de teste.** Produção é de quem constrói o app: migração primeiro, depois a API, depois o site.
- **Testes:** um arquivo novo por etapa em `artifacts/api-server/tests` (rodar um por vez, o banco de teste é lento) mais o
  `permission-matrix`. Existentes que tocam a Escala: `escalas-dia`, `escala-horario-da-pessoa`, `escala-regras-http`,
  `escala-mes`, `regras-de-escala`, `fase-c-escala-avisos`.
- **Conferência de tela em toda etapa:** Administração, Direção, Supervisão e Elenco; 375 e 1360 px; carregando, vazio, erro, com
  dados, texto longo; todas as janelas e fluxos; medidas (texto ≥ 12 px, toque ≥ 44 px, sem rolagem lateral); o script
  `scripts/verificar-nomes-build.mjs` depois do build. Diz com franqueza o que não foi visto.

## As etapas, em ordem

Tamanho: P (pequena), M (média), G (grande). "Babi" = depende de resposta dela. "Aut." = precisa da sua autorização.

### Etapa 0 · Atalho que abre no dia e no show certos · P · Aut.
- **Problema:** o atalho "Abrir no Livro do Dia" da Escala (`escalas.tsx:535` e `:1159`) manda para `/livro-do-dia` sem data nem
  show; vendo amanhã, abre o Livro de hoje (falha do crivo: "abre no dia e no local tocados?").
- **Mudança:** em `livro-do-dia.tsx`, ler `?data=` no estado do dia (`:279`) e `?livro=` num efeito depois da carga (`:328`),
  chamando `open(id)` (`:414`). Na Escala, os atalhos passam a levar a data e o id. Um commit só.
- **Pronto quando:** abrir o Livro de amanhã a partir da Escala de amanhã funciona, para os quatro perfis; id quebrado na URL dá
  uma frase, não tela vazia.

### Etapa 1 · Limpar e dar a cara da planilha · G · sem Babi · migração 0082 pequena (horário da virada)
- **Camadas do topo:** juntar título, dia e abas em uma faixa; visão, grupos e busca em uma barra; os dois cartões de aviso
  ("blocos sem ninguém", "mesma pessoa em dois lugares") viram **um cartão "Atenção do dia"** que só aparece quando há o que ver.
- **Grade "Por pessoa":** régua de horário fixa e **altura pela duração**; **blocos iguais emendados** em faixa; **cor forte por
  tipo** (paleta de 7 tons, bem contrastada, com modo escuro); nome do tipo sempre escrito; colunas estreitas (o dia cabe na tela);
  sem "—"; cabeçalho de coluna fixo; **quem está de folga sai da grade** e vira a listinha "Folgas de hoje".
- **Atenção e leitura:** resumo no topo (escaladas, folgas, choques, exceções, sem atividade, cada um abre a lista); **busca de
  pessoa**; filtro "só exceções e choques"; faixa dos momentos do dia; aviso informativo de tempo parado (40 min, sem bloquear).
- **Dia certo ao abrir:** a regra do horário configurável (seção "o dia seguinte"): duas colunas novas no local (migração **0082**,
  com rollback), campo em Locais só para a Administração, e a Escala e o Livro passam a abrir no dia certo.
- **Tirar o que sobra:** o zoom de 5 níveis some (a grade já cabe); abas raras vão para um menu.
- **Celular:** cartões por pessoa, faixa do dia no topo e **barra de ação fixa embaixo** (Gerar, Enviar minha parte ou Publicar);
  tudo com toque de 44 px.
- **"Por atividade":** "Todo o elenco do dia" no lugar de lista longa de nomes.
- **Arquivos:** novos `components/escala/GradePessoa.tsx`, `GradeAtividade.tsx`, `ResumoDoDia.tsx`, `AtencaoDoDia.tsx`,
  `escala-tokens.css`; `escalas.tsx` só os liga.
- **Pronto quando:** as medições do protótipo se repetem na tela real; a Direção continua "somente leitura".

### Como o campo do horário da virada aparece em Locais (texto bem explicado)

Fica numa janela/cartão com título **"Qual dia a Escala mostra ao abrir"**, com este texto e este jeito:

- **Explicação curta, no alto:** "A escala de um dia costuma ser feita na noite anterior. Aqui você escolhe a partir de que hora a
  Escala deixa de abrir em hoje e passa a abrir no dia seguinte, e a que hora ela volta a abrir em hoje."
- **Dois campos, com as frases completas** (não só "18:00"):
  - "A partir das [18:00], a Escala abre no **dia seguinte**."
  - "A partir das [05:00], a Escala volta a abrir em **hoje**."
- **Um exemplo que muda junto com os campos:** "Com estas horas, às 19:30 de segunda a Escala abre em terça. Às 06:00 de
  terça, ela abre em terça (hoje)." O exemplo usa o dia da semana de verdade, para a pessoa ver o resultado antes de salvar.
- **Uma linha de aviso útil:** "Isso só muda o dia em que a tela abre. Quem quiser ver outro dia usa Hoje, Amanhã ou o calendário."
- **Quem vê:** a Administração edita; a Direção vê o valor sem poder mudar, com "somente leitura"; Supervisão e Elenco não veem.
- **Frases de erro claras**, nunca código: "As duas horas precisam ser diferentes", "A hora de voltar a abrir em hoje precisa ser
  antes da hora de abrir no dia seguinte, no mesmo dia" (se a regra pedir), e erro de rede diz que não salvou e que nada mudou.
- **Rodapé com Cancelar e Salvar**, visível também a 375 px; o valor atual aparece como "Hoje: abre no dia seguinte a partir das
  18:00 e volta a hoje às 05:00". Mudança grava no Registro com o valor antigo e o novo. Dá para **voltar ao padrão** em um toque.
- Conferir a tela com o texto longo, com o teclado aberto no celular e com os quatro perfis.
### Etapa 2 · Agir direto no bloco · M · sem Babi, sem migração
- Tocar no bloco abre um menu **junto do bloco** (no celular, sobe de baixo): **Tirar de…**, **Mudar horário só desta pessoa**
  (reusa `HorarioDialog` e a rota `/escalas/dia/horario`), e **Dividir** só se a Etapa 2 provar que cabe sem mexer na regra.
  Bloco de show: só "Abrir o Livro" (show não muda de horário; a saída é tirar do show, pelo Livro).
- Quem pode: Administração em qualquer área, Supervisão só na área dela, Direção só lê, com a **frase da recusa** dizendo quem pode.
- Mudança depois de publicado marca "alterada depois de publicada" e avisa a Administração (já existe para o horário).
- Tudo com **Registro**, **motivo** quando é exceção e **desfazer** na hora.
- **Teste novo:** recusa por área e por perfil; Registro; republicação sinalizada.

### Etapa 3 · Preencher em lote · M · Babi (pergunta 4) · pode precisar de rota nova
- Marcar várias pessoas (ou um grupo que já existe na Programação) e aplicar a atividade de uma vez; **prévia** (quem entra, quem
  fica de fora por folga ou por outra área, quais choques); **desfazer**.
- Reaproveita `AtividadeDeHojeDialog` (`:1558`) se a rota atual aceitar várias pessoas; senão, **uma rota nova em lote** com
  Registro na mesma transação e **um aviso por acontecimento** (não um por pessoa). Show não entra: show é do Livro.
- **Teste novo:** lote com folga no meio, lote com choque, lote de outra área recusado com frase.

### Etapa 4 · Livros do dia dentro da Escala, com "Conferido" · M a G · Babi (pergunta 9) · Aut. · migração 0083
- Na Escala, um cartão por show do dia (horário, tipo, chamadas, mudança, vaga sem ninguém, conferido) e o botão **"Conferir os
  Livros do dia (N)"**: abre o primeiro que falta, **"Conferido" abre o próximo, e o último volta sozinho à Escala**. Tocar num
  cartão só também volta sozinho depois do "Conferido".
- **Quem confere:** o **responsável por show**, que já existe em Shows; a Administração confere qualquer um. A fila de cada pessoa
  só tem os shows dela.
- **Banco:** marca de conferido por Livro do Dia (quem e quando), com rollback; reabre se o Livro mudar depois (mesma ideia da
  "pronta que cai"). Rota para conferir, com Registro e aviso à Administração.
- **No `livro-do-dia.tsx`** (com a sua autorização): o botão "Conferido" e o retorno à Escala; nada além disso.
- **Teste novo:** conferir e desconferir, fila só com os shows do responsável, queda da marca quando o Livro muda.

### Etapa 5 · Programação mais clara e Tipo da atividade · M · Babi (pergunta 1) · migração 0084
- **Sem banco:** "+ Bloco" vira **botão de verdade**; sai a faixa do dia, que não serve a ela; o painel de edição deixa de ficar lá embaixo.
- **Com banco:** tabela de **tipos por local** (os 7 vêm prontos; só a Administração cria, renomeia e desativa; tipo usado só se
  desativa; cor de uma lista fixa; tudo no Registro) e a coluna `tipo` em `programacao_blocos` (`schema/escalas.ts:37`). A atividade
  só de hoje também escolhe o tipo. "Todo mundo do local" passa a se chamar **"Todas as áreas"**, só o texto.
- **Teste novo:** tipo usado não apaga; onde não há tipo, o palpite pelo nome continua.

### Etapa 6 · Enviar, conferir e publicar tudo · M · Babi (perguntas 5, 7, 8)
- "Publicar tudo" com **janela de confirmação e resumo**: o que vai ser publicado, quantas áreas prontas, pendências abertas
  (vaga sem ninguém, Livro não conferido) como aviso, e o resultado passo a passo (Escala, depois cada Livro) com frase clara se
  algum falhar.
- "Enviar minha parte" **só aparece com escala gerada**; com pendência aberta, avisa antes; a marca **cai sozinha** se alguém mexer
  depois (se a Babi confirmar) e a Supervisão é avisada no sino.
- Se duas pessoas mexem ao mesmo tempo: versão conferida ao salvar e frase clara, sem apagar o trabalho de ninguém.

### Etapa 7 · Copiar de outro dia · M · Babi (pergunta 10)
- "Igual ao último sábado", só com atividades e pessoas disponíveis, mostrando quem ficou de fora e pedindo confirmação forte.

## Ordem e o que depende da Babi

| Etapa | Depende da Babi? | Banco | Toca `livro-do-dia.tsx`? |
|---|---|---|---|
| 0 Atalho certo | não | não | **sim** (Aut.) |
| 1 Limpar e cara da planilha (+ horário da virada) | não | 0082 | não |
| 2 Agir direto no bloco | não | não | não |
| 3 Lote | pergunta 4 (recomendação já vale) | não | não |
| 4 Livros e "Conferido" | pergunta 9 (**já respondida**: responsável por show) | 0083 | **sim** (Aut.) |
| 5 Programação e Tipo | pergunta 1 | 0084 | não |
| 6 Publicar tudo e "Pronta" | perguntas 5, 7, 8 | não | não |
| 7 Copiar de outro dia | pergunta 10 | não | não |

**Recomendo começar pelas Etapas 1 e 2:** juntas já mudam a cara e cortam os cliques que mais pesam, e nenhuma depende da Babi nem
mexe no banco. Cada etapa é usável sozinha; dá para parar depois de qualquer uma.

## Ordem de promoção (quando chegar a hora, por quem constrói o app)

1. Backup do banco de produção. 2. Migrações 0082, 0083 e 0084, em ordem, depois da 0081 da outra sessão. 3. API. 4. Site. 5. Conferência
em produção só leitura; escrever lá exige pedir antes. Nada disso acontece sem o "pode enviar".

## Riscos e cuidados

- `_journal.json` e `show-book.ts` estão com alterações soltas de outra sessão: combinar a ordem antes de qualquer commit de migração.
- O banco de teste é lento (5 a 12 s por escrita); suíte parecendo travada costuma ser só isso.
- Dados de exemplo com nome de gente só dentro de `import.meta.env.DEV`; rodar `verificar-nomes-build.mjs` depois do build.
- Não presumir gênero de ninguém nos textos da tela.

## O que eu preciso de você para começar

1. **OK para a Etapa 1** (e a 2) como primeira entrega, em um ramo novo a partir de `acd003b`.
2. **Autorização** para a mudança pequena no `livro-do-dia.tsx` (Etapa 0), em commit só dela, quando chegar a hora.
3. Dizer se a Babi pode responder as perguntas antes da Etapa 3, ou se sigo com as recomendações do plano.
