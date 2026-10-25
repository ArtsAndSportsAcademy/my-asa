# Plano de construção: Escala mais fácil, mais limpa e mais bonita

Versão reestruturada (24/10/2026). Este é o plano **para construir**. O outro (`plano-escala-mais-facil-para-a-babi.md`) é o resumo
para a Babi decidir regras e usa outra numeração, mais conceitual. **Nada daqui foi feito no app ainda.**

## 1. O objetivo, em uma frase

**Manter o que já existe e funciona, limpar tudo e fazer cada tarefa com o menor número de cliques**, deixando a Escala mais bonita
e mais intuitiva (Apple Design).

Metas que dá para medir (hoje → depois): tirar uma pessoa de uma atividade, **2 telas e uma lista de 25 → 1 toque no bloco**; atividade
para 15 pessoas, **~21 cliques → 4**; bloco novo da Programação para 5 dias, **~10 → 5**; alguém que sai no meio do dia,
**bloco por bloco → 1 ação**. Etapa que não bater a meta não está pronta.

## 2. Como vocês trabalham de verdade

- **O dia que se prepara é o seguinte.** A escala e o Livro de terça são feitos e publicados na noite de segunda.
- **Folga e recesso já são conhecidos:** a grade de folgas é publicada no fim do mês e a Escala já a lê.
- **O que sobra é o imprevisto do dia:** doença, acidente, alguém que precisa ir embora no meio do dia. Aí é preciso ver o que acontece
  com o resto do dia.
- **Pessoa não tem local.** Cada show tem o seu **elenco base** (as pessoas marcadas no Livro dele). Nos textos da tela nunca se escreve
  "todo mundo do local": escreve-se "elenco todo do show" ou "limitado a N".
- **Rodízio justo nos shows:** ninguém pode fazer todos os shows de elenco limitado do dia enquanto outra pessoa faz só um ou nenhum.

## 3. O que já existe e NÃO se refaz (conferido no código)

- A Programação (a da semana) gera o dia e o Livro do Dia; a Escala tira folga e recesso; o Livro resolve as vagas sozinho
  (titular, depois substituto da posição, depois reserva do grupo).
- **"Publicar tudo" já é verdade no servidor:** `publicarOuRepublicar` (`routes/escalas.ts:637`) publica a Escala **e os Livros do Dia na
  mesma transação**, com Registro, e só se todas as áreas estiverem prontas. Falta só o botão explicar e pedir confirmação.
- **"Gerar o mês"** (`services/escala-mes.ts`, `gerar-mes-dialog.tsx`) cria em rascunho Escala e Livros de todos os dias, em ordem
  (o rodízio depende dos dias anteriores), sem publicar nem avisar, e pula dia já gerado.
- Hoje / Amanhã / Calendário; aviso "blocos sem ninguém"; choque com "Tirar de…" e "Mudar horário"; desfazer da Programação; barra de
  baixo com Gerar / Pronta / Publicar; "pronta" por área (`escala_areas_prontas`).
- O Livro do Dia navega por dias, mostra "o que mudou" (`pattern-diff`, `delta`) e "sem ninguém escalado hoje".
- As visões **"Por pessoa"** e **"Por atividade"** continuam.

## 4. Decisões fechadas (não reabrir sem perguntar)

1. **Um bloco só por atividade, emendado em faixa** quando se repete (um "Ensaio do show" largo, não vários lado a lado). Cor forte por
   tipo, **sempre com o nome escrito**, régua de horário, altura pela duração, colunas estreitas.
2. **Quem não trabalha no dia (folga, recesso, afastamento) sai da grade** e vira uma linha compacta no resumo do topo, "Não trabalham hoje
   (3) · ver todos", com a lista por motivo. A busca ainda acha essas pessoas e diz "está de folga hoje". Quem foi **chamado de propósito
   na folga** entra na grade com o motivo escrito. O Elenco vê "Você está de folga hoje".
3. **O Livro é do show inteiro, não da pessoa.** Na Escala o show é um bloco comum, sem cenas nem posições. **Não existe segunda tela do
   Livro:** cartões "Livros do dia" abrem o Livro que já existe, no dia e no show tocados.
4. **Conferência guiada, sem ir e voltar:** "Conferir os Livros do dia (N)" abre o primeiro que falta; "Conferido" abre o próximo; no
   último volta sozinho à Escala. **Quem confere é o responsável por show** (já existe em Shows); a Administração confere qualquer um;
   cada Supervisão só vê os shows dela. "Conferido" aparece no Livro e no cartão da Escala.
5. **Rascunho:** Administração e Supervisão veem; só o Elenco vê o publicado.
6. **A Escala abre no dia certo, por horário configurável por local:** a Administração define a partir de que horas passa a abrir no dia
   seguinte (sugestão 18:00) e a partir de que horas volta a abrir em hoje (sugestão 05:00). Fica em Locais, bem explicado (ver Etapa 1).
7. **Programação da semana continua**, mais enxuta: o que acontece no mesmo horário aparece **lado a lado numa linha só**; "+ Bloco" vira
   botão; ganha o campo Tipo; "Todo mundo do local" passa a se chamar **"Todas as áreas"** (só o texto).
8. **Equilíbrio dos shows:** só contam os shows de **elenco limitado**; o de elenco todo do show (a Patinação) não conta. A marca é **do
   show** e vale **até alguém mudar** (nunca por dia). **Mudar vale a partir de onde mudou; o que passou não muda.**
9. **Os planos para a Babi não precisam esperar a resposta dela para as Etapas 0 a 3.**

## 5. Como vamos agir (método)

- **Ramo novo** a partir do topo de `codex/myasa-novo` (hoje `acd003b`). O ramo `codex/escala-mais-facil` só tem os documentos. Nunca merge na
  `main`. **Nada vai ao GitHub nem a produção sem o "pode enviar" de quem constrói o app.**
- **Um commit por etapa** (a Etapa 1 em três commits), com mensagem longa em prosa dizendo o que estava errado e por que a mudança resolve.
- **Peças novas em arquivos novos** (`src/components/escala/…`, com CSS próprio de tokens de cor e tamanho). `escalas.tsx` tem 1.615 linhas, quase
  todo o estilo dentro do JSX; ele só liga as peças. Assim o redesenho não vira edição gigante e outras sessões não esbarram.
- **Não tocar** em `print-day.tsx`, em `AjusteCelulaDialog` (`escalas.tsx:850`) nem no trecho das vagas por personagem. `livro-do-dia.tsx` só
  com autorização, em commits só dele. A tela Shows (`shows.tsx`) está com alterações soltas de outra sessão: combinar a ordem antes de mexer.
- **Migrações só no banco de teste**, cada uma com rollback em `lib/db/drizzle/rollback/` e registro em `meta/_journal.json` (que outra
  sessão também mexe). A 0081 é de outra sessão; as nossas: **0082** horário da virada, **0083** conferido, **0084** tipos, **0085**
  correção do equilíbrio por show. Produção é de quem constrói o app: migração, depois API, depois site.
- **Mostrar cada etapa pronta antes de seguir.** Só digo "pronto" depois de ver: Administração, Direção, Supervisão e Elenco; 375 e 1360 px;
  carregando, vazio, erro, com dados, texto longo; todas as janelas e fluxos; medidas (texto ≥ 12 px, toque ≥ 44 px, sem rolagem lateral);
  `scripts/verificar-nomes-build.mjs` depois do build. E digo com franqueza o que **não** foi visto.
- **Crivo do AGENTS.md em toda ação:** várias pessoas de uma vez, quem pode e a frase da recusa, celular, aviso (um por acontecimento),
  Registro com motivo, desfazer, erro honesto, vazio explicado, texto acompanha o contexto (nada de "hoje" vendo amanhã), rodapé com
  confirmar e cancelar, duas pessoas ao mesmo tempo (versão conferida ao salvar).
- **Testes:** um arquivo novo por etapa em `artifacts/api-server/tests`, rodando um por vez (o banco de teste é lento), mais o
  `permission-matrix`. Já existem: `escalas-dia`, `escala-horario-da-pessoa`, `escala-regras-http`, `escala-mes`, `regras-de-escala`,
  `fase-c-escala-avisos`.
- **Cor por tipo:** `toneOf` (`escalas.tsx:88`) hoje adivinha pelo nome. Passa a ler o Tipo gravado e cai no palpite só onde ninguém escolheu.
- **Dados de exemplo com nome de gente** só dentro de `import.meta.env.DEV`. Nunca presumir gênero de ninguém nos textos.

## 6. As etapas, em ordem

Tamanho: P pequena, M média, G grande. **Aut.** = precisa da sua autorização. **Babi** = depende de resposta dela.

### Etapa 0 · O atalho abre o dia e o show certos · P · Aut.
- **Problema:** o atalho "Abrir no Livro do Dia" da Escala (`escalas.tsx:535`, `:1159`) manda para `/livro-do-dia` sem data nem show; vendo amanhã, abre o Livro de hoje.
- **Mudança:** em `livro-do-dia.tsx`, ler `?data=` no estado do dia (`:279`) e `?livro=` num efeito depois da carga (`:328`), chamando `open(id)` (`:414`). Um commit só.
- **Pronto quando:** abrir o Livro de amanhã a partir da Escala de amanhã funciona para os quatro perfis; id quebrado dá uma frase.

### Etapa 1 · A Escala com cara de planilha · G · sem Babi · migração 0082
Em três commits:
1. **Topo e barra de ação.** Juntar título, dia e abas numa faixa; visão, grupos e busca numa barra; os dois cartões de aviso viram **um
   "Atenção do dia"** que só aparece quando há o que ver; o zoom de 5 níveis some; abas raras vão para um menu; no celular, **barra de ação
   fixa embaixo** (Gerar, Enviar minha parte ou Publicar). "Enviar minha parte" só aparece com escala gerada.
2. **A grade nova.** "Por pessoa" com régua de horário, altura pela duração, blocos emendados em faixa, cor forte por tipo com nome escrito,
   colunas estreitas, sem "—", cabeçalho fixo. Resumo no topo (escaladas, choques, exceções, sem atividade; cada número abre a lista), "Não
   trabalham hoje · ver todos", **busca de pessoa**, filtro "só exceções e choques", aviso informativo de tempo parado (40 min, nunca
   bloqueia), faixa dos momentos do dia. "Por atividade" diz "Todo o elenco do dia". Celular: cartões por pessoa com a faixa do dia no topo.
   Estados explicados na tela (contorno vermelho = choque, amarelo = exceção). **A posição final da lista "Não trabalham hoje" se decide aqui,
   testando a linha compacta e a listinha aberta.**
3. **O dia certo ao abrir + Locais.** Duas colunas novas no local (migração **0082**, com rollback). Em **Locais**, cartão **"Qual dia a
   Escala mostra ao abrir"**: explicação curta ("A escala de um dia costuma ser feita na noite anterior…"), duas frases completas com campo
   de hora ("A partir das [18:00], a Escala abre no dia seguinte." / "A partir das [05:00], a Escala volta a abrir em hoje."), um **exemplo
   vivo** com o dia da semana ("às 19:30 de segunda a Escala abre em terça"), o aviso de que isso só muda o dia ao abrir, erros claros ("as
   duas horas precisam ser diferentes"; falha de rede diz que **não salvou**), rodapé Cancelar/Salvar visível a 375 px, "voltar ao padrão",
   Registro com valor antigo e novo. Administração edita; Direção vê "somente leitura"; Supervisão e Elenco não veem. O cabeçalho da
   Escala diz o dia ("Terça, 28 · amanhã · rascunho") e o botão diz "Publicar a escala de terça".
- **Pronto quando:** as medições do protótipo se repetem na tela real, nos quatro perfis.

### Etapa 2 · Agir direto no bloco, e o imprevisto do dia · M · sem Babi · sem migração
- **Menu no bloco:** tocar abre um menu **junto do bloco** (no celular, sobe de baixo) com **Tirar de…** e **Mudar horário só desta pessoa**
  (reusa `HorarioDialog` e `/escalas/dia/horario`). Bloco de show: só **"Abrir o Livro"** (show não muda de horário; a saída é tirar do show
  pelo Livro).
- **"Saiu / não vem a partir de [hora]":** ação no cabeçalho da pessoa, um toque tira a pessoa de tudo dali em diante. Pede o motivo (doença,
  emergência, outro) e mostra uma **prévia**: quais atividades e shows ela deixa e quem cobre cada show (reserva do grupo, pelo Livro). O que
  ficar sem ninguém vai para o "Atenção do dia". Avisa a Administração e a Supervisão da área (um aviso por acontecimento; a conferir se
  também o responsável de cada show afetado), marca a escala publicada como "alterada depois de publicada", grava no Registro com o motivo,
  tem **desfazer**. Liga com o "Informar ausência" do Elenco (a conferir como funciona hoje a tela Check-in e ocorrências).
- **Quem pode:** Administração em qualquer área, Supervisão só na área dela, Direção só lê, sempre com a **frase da recusa** dizendo quem pode.
- **Teste novo:** recusa por área e por perfil; prévia do imprevisto; Registro; republicação sinalizada.

### Etapa 3 · Programação enxuta · P a M · sem Babi · sem migração
- "+ Bloco" vira **botão de verdade**; sai a faixa do dia, que ali não serve; o painel de edição deixa de ficar lá embaixo.
- **Horários iguais viram uma linha só**, com o que acontece no mesmo horário **lado a lado**; blocos que se repetem em vários dias da semana se emendam.
- **Pronto quando:** criar bloco para 5 dias em ~5 cliques; a tabela da semana fica visivelmente mais curta.

### Etapa 4 · Preencher em lote · M · Babi (pergunta 4; vale a recomendação) · pode precisar de rota nova
- Marcar várias pessoas ou um grupo que já existe na Programação e aplicar a atividade de uma vez; **prévia** (quem entra, quem fica de fora por
  folga ou por outra área, quais choques); **desfazer**. Reaproveita `AtividadeDeHojeDialog` (`:1558`) se a rota aceitar várias pessoas; senão, **rota
  nova em lote**, com Registro na mesma transação e um aviso por acontecimento. Show não entra: é do Livro. Supervisão só em pessoas da área dela.

### Etapa 5 · Livros do dia na Escala, com "Conferido" · M a G · Babi (pergunta 9: já respondida) · Aut. · migração 0083
- Cartão por show do dia (horário, tipo, chamadas, mudança, vaga sem ninguém, conferido), "Conferir os Livros do dia (N)" e a fila guiada (decisão 4).
- **Banco:** marca de conferido por Livro do Dia (quem e quando), que cai se o Livro mudar depois. Rota para conferir, com Registro e aviso.
- **No `livro-do-dia.tsx`** (com autorização): só o botão "Conferido" e o retorno à Escala.
- **Teste novo:** conferir e desconferir; fila só com os shows do responsável; queda da marca.

### Etapa 6 · Tipo da atividade · M · Babi (pergunta 1) · migração 0084
- **Tipos por local** (os 7 vêm prontos: treinos no gelo, ensaios e preparação, shows e teatro, interações e personagens, produção e apoio, pausas e
  almoço, outras atividades); só a Administração cria, renomeia e desativa; tipo usado só se desativa; cor de lista fixa; tudo no Registro. Coluna
  `tipo` em `programacao_blocos` (`schema/escalas.ts:37`); a atividade só de hoje também escolhe o tipo. **Teste:** tipo usado não apaga; sem tipo, o palpite continua.

### Etapa 7 · Enviar a parte e publicar tudo · M · Babi (perguntas 5, 8) · sem migração
- "Publicar tudo" com **janela de confirmação e resumo** (o que vai ser publicado, áreas prontas, pendências abertas como aviso) e resultado passo a
  passo, com frase clara se algo falhar. "Enviar minha parte" avisa antes se há pendência. A marca **cai sozinha** se alguém mexer depois (se a Babi
  confirmar), avisando a Supervisão no sino. Duas pessoas ao mesmo tempo: versão conferida e frase clara.

### Etapa 8 · Copiar de outro dia · M · Babi (pergunta 10)
- "Igual ao último sábado", só com atividades e pessoas disponíveis, mostrando quem ficou de fora, com confirmação forte.

## 7. Fase 2 (depois das Etapas 1 a 3): gerar a semana e ver o equilíbrio · migração 0085

- **Gerar a semana:** o mesmo motor do "Gerar o mês" com um intervalo de dias (parâmetro novo no servidor) e um botão na Escala. Depois, a conferência dia a dia.
- **Visão "Semana" (só leitura):** uma linha por pessoa, os dias em colunas, e no fim da linha a contagem de **shows de elenco limitado** na semana. Destaca
  quem está muito acima ou muito abaixo do grupo. Não serve para preencher; serve para ver e conferir o rodízio.
- **Qual show conta:** derivado do cadastro do show: elenco base × vagas por apresentação (se as vagas são iguais ao elenco base, é "elenco todo" e não conta;
  se são menos, é "limitado a N" e conta). Um **interruptor "Conta para o equilíbrio" por show**, na Semana e na Programação, corrige à mão (só a
  Administração, com Registro; a Direção vê). O dado fica **no show**, vale até mudar, e **mudar vale a partir de onde mudou** ("Esta mudança vale a partir de hoje");
  o relatório do mês guarda a conta do jeito que estava naquele mês.
- **A conferir no código:** como o elenco base é guardado e mostrado no cadastro do show; se o Livro conta o equilíbrio por dia ou só por show; como a semana gerada
  reage a um imprevisto feito depois.
- **Nota:** a "grade pessoa × dia" tinha sido adiada em 20/10; esta versão é só leitura e tem uso claro. Reabrir é decisão de quem constrói o app.

## 8. Fase 3: relatório do mês · depois de um mês real de uso
- Quanto cada pessoa fez e o que aconteceu. Não existe hoje. Precisa definir o que entra, quem vê (dados por pessoa: Administração e Direção) e se sai em tela ou em arquivo.

## 9. Resumo: o que depende de quem

| Etapa | Depende da Babi? | Banco | Toca `livro-do-dia.tsx`? |
|---|---|---|---|
| 0 Atalho certo | não | não | **sim** (Aut.) |
| 1 Cara de planilha + virada | não | 0082 | não |
| 2 Agir no bloco + imprevisto | não | não | não |
| 3 Programação enxuta | não | não | não |
| 4 Lote | pergunta 4 | não (ou rota nova) | não |
| 5 Livros e "Conferido" | pergunta 9 (**respondida**) | 0083 | **sim** (Aut.) |
| 6 Tipo da atividade | pergunta 1 | 0084 | não |
| 7 Enviar e publicar tudo | perguntas 5, 8 | não | não |
| 8 Copiar de outro dia | pergunta 10 | não | não |
| Fase 2 Semana e equilíbrio | regra de "limitado" (pergunta nova) | 0085 | não |

**Recomendo começar pelas Etapas 1, 2 e 3**, nessa ordem: mudam a cara e cortam os cliques que mais pesam, e nenhuma depende da Babi.

## 10. Ordem de promoção (por quem constrói o app, quando chegar a hora)

1. Backup do banco de produção. 2. Migrações 0082 a 0085, em ordem, depois da 0081 da outra sessão. 3. API. 4. Site. 5. Conferência em produção só leitura;
escrever lá exige pedir antes. Nada disso acontece sem o "pode enviar".

## 11. Riscos e cuidados

- `_journal.json`, `show-book.ts` e `shows.tsx` estão com alterações soltas de outra sessão: combinar a ordem antes de qualquer commit de migração ou de mexer em Shows.
- O banco de teste é lento (5 a 12 s por escrita); suíte parecendo travada costuma ser só isso.
- Não verificado ainda: o conteúdo dos testes existentes, o `show-book.ts` solto, a tela Check-in e ocorrências, e a Supervisão com o dia em rascunho (a amostra não simula o limite da área).

## 12. Para começar

1. **OK para as Etapas 1, 2 e 3**, em ramo novo a partir de `acd003b`, mostrando cada tela pronta antes de seguir.
2. **Autorização** para a mudança pequena no `livro-do-dia.tsx` (Etapas 0 e 5), em commits só dela.
3. Dizer se a Babi pode responder antes da Etapa 4, ou se sigo com as recomendações do plano.
