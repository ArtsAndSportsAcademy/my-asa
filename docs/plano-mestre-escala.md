# Plano mestre da Escala (26/10/2026, noite)

Este é o **único plano vivo**. Ele junta os dois que existiam:
- `docs/plano-de-construcao-escala-mais-facil.md` (24/10): as Etapas 0 a 8 e as Fases 2 e 3. **O que ele diz que "nada foi feito" está desatualizado.** Fica como histórico e como detalhe da Fase 2.
- `docs/plano-proximos-passos-escala-2026-10-26.md` (26/10): os pacotes A a L e as decisões da usuária. Fica como detalhe de cada pacote.

Regra de uso: o que mudar de estado muda **aqui primeiro**. Código só com o "pode começar" da usuária; envio ao GitHub só com o "pode enviar"; produção (migração, API, site) é de quem constrói o app, nessa ordem.

## 1. Feito e em produção (migrações até a 0084)
| O quê | De onde vem |
|---|---|
| Etapas 0 a 7: atalho abre o dia certo; Escala com cara de planilha e virada do dia por local; agir no bloco e "Saiu no dia"; Programação enxuta; preencher em lote; Livros do dia na Escala com "Conferido"; tipos de atividade com cores; "Enviar minha parte" e publicar com confirmação | plano de construção |
| Livro do Dia: "Trazer as novidades do Livro do Show", vagas editáveis (Escolher/Tirar), "Ver quem faz o quê" | plano de 26/10 (já promovido em parte) |

## 2. Feito, enviado ao GitHub e **ainda NÃO promovido**
Ramo `codex/escala-mais-facil`, até `ab5cb72`. **Ordem: migração 0085, depois o site, depois a API** (a ordem mudou por causa do "Conferido" que sai da API, seção 3; o commit `831f1e6` e o `2aeea26` ainda não foram enviados).
| Commit | O quê | Vai em |
|---|---|---|
| `f432842` | Erro de banco responde 503 e não derruba a sessão (A1) | API |
| `f19b2c7` | Resumo de "quem faz" na Escala e na impressão (C) | site |
| `ac42b57`, `82b4ffb`, `f5d5204`, `622a014`, `e2d9014`, `7ee62a2`, `64c5e3d`, `e3edcf4`, `5cd6fb9`, `e1be6c3` | Defeitos A2 a A9 | API e site |
| `8318597` | Nomes de fábrica novos dos tipos (B) | API |
| `05ea8aa` | Botão "Refazer este dia do zero"; impressão sem "vagas sem ninguém" e com "Escrever o nome de todo mundo" | site |
| `994c73b` | Posição de função (Produção) nasce com vaga aberta | API |
| `79ffd8f` | Rodízio conta os dias gerados em rascunho (D) | API |
| `0b313a6` | Bloco flexível (almoço em janela) e prioridade da atividade específica (E) — **migração 0085** | migração, API, site |

Antes de promover: rodar a bateria de testes de novo (um arquivo por vez) e conferir o que ainda não foi visto na tela (ver seção 6).

## 3. Feito e commitado, **ainda não enviado ao GitHub** (26/10, noite)
- `831f1e6` **E, trecho:** a atividade específica corta só o trecho que cruza o bloco geral (gelo 08:40–11:00 + ensaio 10:00–11:00 → gelo até 10:00; a tela diz "Treino de gelo até 10:00 · ENSAIO às 10:00"); no meio do bloco, sai do geral inteiro; choque entre duas específicas é só aviso. Sem migração.
- `2aeea26` **M + N:** o "Conferido" saiu do app inteiro (cartões, faixa, botão, conferência guiada, aviso ao publicar, rotas); a Escala abre por atividade e a grade está no topo, com letra de 14 a 15 px. Sem migração. **A API perde as rotas de conferir: promover o SITE primeiro e a API logo depois.**
- `c2a52ff` **Cabeçalho compacto no celular** (até 720 px): a grade passou de ~920 px para ~307 px do topo a 375 px (321 e 353 px a 414 px). Visto: Administração, Supervisão e Direção com dados, a 360, 375 e 414 px. Não visto: Elenco com escala publicada, "Atenção do dia" aberta com dados, toque em aparelho de verdade. Botões "Hoje/Amanhã/Calendário" e visões têm 29–38 px de altura visível (área de toque de 44 px ao redor): pode ainda parecer pequeno. Sem migração.
- `12f43a8` **Consertos pequenos da conferência no computador:** rodapé da Programação, papéis do Livro do Dia, "hoje" → "do dia", Direção sem "Gere o dia…", etiquetas das áreas em uma linha.
- `36f402e` **Folga vence também na vaga do show:** a Escala não mostra mais gente de folga ocupando personagem (defeito antigo, desde 23/10); chamada de propósito com motivo continua aparecendo.
- `2c0460b` **Conferência da sessão principal (27/10):** a Supervisão agora corrige ("Mudar horário", "Tirar do dia") a atividade só do dia que criou; o "×" do Livro do Dia ganhou 44 px de toque.
- **Conferência da sessão principal (26/10 à noite):** os 20 arquivos de teste de API passaram; tsc (db, API, site), build e verificação de nomes passaram; vistas na tela, com dados, Administração (1360 e 375 px), Supervisão, Direção e Elenco (375 px), Livro do Dia (375 px) e impressão. **Não visto:** Supervisão, Direção e Elenco a 1360 px; Programação com "Janela flexível" a 375 px; janelas Ajustar/Mudar horário/Publicar abertas; "chamado na folga" na janela de Publicar; Meu Dia com dois locais; PDF de verdade; toque em aparelho.
- **Segunda rodada de conferência (27/10, sessão principal), tudo visto na tela com dados:** Administração, Supervisão, Direção e Elenco a 1360 e 375 px; janelas Ajustar, Mudar horário, Publicar (com "chamada na folga" e vagas sem ninguém), Novo bloco com "Janela flexível" (1360 e 375); Programação; recusas da Supervisão e da Direção em português; Meu Dia com dois locais (contador subiu de 4 para 5); PDFs de verdade (1 página por atividade, com nomes e por pessoa; controles não saem no papel). Consertado: barra de baixo e "Atenção do dia" no celular (barra de ~216 para ~91 px). **Ainda não visto:** toque em aparelho de verdade; o app instalado (PWA).
- **Para decidir depois:** "saída 13:30" na Minha escala vem do fim da janela do almoço, que não é a saída real da pessoa; a grade a 375 px começa a ~400 px do topo quando há "Atenção do dia", e a barra de baixo ocupa ~20% da altura; "Hoje/Amanhã/Calendário" e as abas medem 29–42 px de altura.
- A senha das contas `teste.*` do banco de teste foi redefinida e gravada só em `artifacts/api-server/scripts/empresa-de-teste.local.json` (checkout principal, ignorado pelo git).

## 4. Falta fazer (ordem sugerida)
| # | Pacote | Tam. | Migração | Observação |
|---|---|---|---|---|
| 0 | **O. Equipe por local na Programação** (seção 10): é o que falta para a Escala ser entregue às Supervisões; vem antes de G, H e J | G | **0088** | decidido em 28/10; código só com o "pode começar" |
| 1 | **Promover** o que está na seção 2 e 3; depois renomear os tipos já existentes em produção (janela "Tipos de atividade"); "Trazer as novidades" no Teatro 11:30 e Boas Vindas do dia 22; "Refazer" no Opening de terça | — | 0085 | só quem constrói o app roda em produção; antes, `DB_POOL_MAX=3` na API (ver `docs/quando-o-app-cai.md`) |
| 2 | **F. Chamadas** (desenho aprovado em 27/10 em `docs/desenho-chamadas-escala.md`; **F1 construída e commitada localmente em 27/10**: migração 0086, rotas e leitura na Escala; faltam F2 editor e F3 telas e aviso) (várias por show, configuráveis; ocupa tempo ou só informativa; aviso; quem = Livro do Dia) | G | **0086** | **desenhar a tela de configuração antes** e mostrar à usuária |
| 3 | **Fase 2 do plano de construção: semana e equilíbrio** (gerar a semana; visão "Semana" só leitura com a contagem de shows de elenco limitado; interruptor "Conta para o equilíbrio" por show) | G | **0090** (a 0087 virou "Editar neste dia" e a 0088 a equipe por local) | é o "plano esquecido" do rodízio por semana; **pergunta nova: qual a regra de "limitado"** |
| 4 | **G. Tempo disponível** (aviso a partir de 30 min, configurável em Locais) | M | **0089** | só Supervisão e Administração veem |
| 5 | **H. Etapa 8: copiar de outro dia** (mostra quem ficou de fora e por quê) | M | não | |
| 6 | **I. Formações no Livro do Dia** (criar do zero, renomear, arquivar) | M–G | talvez | conferir antes na tela com um show de mapa de palco |
| 7 | **J. Menos cliques** (cadastro de várias pessoas, ligar vários personagens ao show, repetir horários nas sessões, bloco em vários horários) | M cada | não | |
| 8 | **Fase 3: relatório do mês** | G | ? | só depois de um mês real de uso; definir o que entra e quem vê |

A numeração das migrações é a prevista; a primeira livre hoje (28/10) é a **0088**.

## 5. Em espera (depende da Babi)
- **K. "Onde a pessoa trabalha no dia":** virou o pacote **O** (seção 10, decidido em 28/10), inclusive o tempo de deslocamento, que é configurável e não espera mais a Babi.
- **Pessoa em duas áreas** (Amanda e Antônio): depende de K.
- **Regra de "limitado"** para a Fase 2 (quais shows contam para o equilíbrio).

## 6. Não visto na tela (antes de promover)
A5 (Meu Dia com dois locais) e a linha de "chamado na folga" do A2; "Enviar minha parte" da Supervisão; Elenco a 1360 px e Supervisão a 1360 px; impressão em PDF; Meu Dia no navegador; "Gerar o mês" pela tela (rodízio); a tela do Livro do Dia no celular (janela de Refazer).

## 7. Decisões da usuária (não reabrir)
1. **No show = folga.** Nada a construir.
2. **Chamadas:** várias por show, tudo configurável (nome, horário fixo ou "X min antes", duração, ocupa tempo ou só informativa, aviso opcional; no show por sessão, no bloco da Programação e na atividade só de hoje).
3. **Rodízio:** dia gerado em rascunho pesa só para os dias **depois** dele; rascunho de dia passado não publicado não conta.
4. **Tempo disponível:** a partir de 30 min, só Supervisão e Administração, configurável em Locais.
5. **Almoço:** janela sem nomes e sem choque.
6. **Prioridade:** atividade específica ganha do bloco geral, **cortando só o trecho que cruza** (no meio do bloco, sai do geral inteiro). Duas específicas no mesmo horário: **choque só como aviso**, nunca bloqueia salvar nem publicar. Bloco de **grupo** (equipe cadastrada) fica fora da regra.
7. **Resumo "quem faz":** 80% = "Elenco todo"; por área ≥80% da área ("Bailarinos e Fulano"); show grande (>12 posições) = "Elenco do show: N pessoas · ver Livro do Dia"; mínimo de 3 pessoas para resumir; mais de 3 de fora volta a listar nomes. Na impressão há a opção "Escrever o nome de todo mundo".
8. **Fora do plano:** Yeti em dupla, aceitar/recusar mudança (só avisa), tipo "No show", tela "Pausas", dia 23 como estrutura própria.
9. **Supervisão vê tudo.** Quem pode mexer no Livro de um show: como hoje (Administração, Supervisão do local, responsável).
10. **O "Conferido" sai do app inteiro** (pacote M); a Escala é o centro da tela e abre por atividade (pacote N).
11. **Tipos já existentes em produção** são renomeados depois, pela janela "Tipos de atividade".

## 8. Regras de trabalho (valem para toda sessão)
Português simples; dizer o que **não** foi visto; só commitar os arquivos da própria sessão, por caminho; máximo de duas sessões em paralelo e em arquivos diferentes; testes um arquivo por vez (o banco de teste tem 15 conexões); nunca escrever em produção sem pedir; dados de exemplo com nome de gente só em `import.meta.env.DEV`; migração em produção é de quem constrói o app.

## 9. Atualização de 27/10/2026 — chamadas e "Editar neste dia"
- **Chamadas (F1, F2, F3):** feitas, enviadas ao GitHub e a **migração 0086 já aplicada em produção** (backup antes). Falta promover a **API e depois o site**. Detalhes em `docs/desenho-chamadas-escala.md` (seções 7b a 7d).
- **Editar a atividade só neste dia (migração 0087, só no banco de teste; NÃO enviado):** na Escala por atividade, o botão "Editar neste dia" muda o **nome, o horário (para todos) e o tipo/cor** de uma atividade que vem da Programação, só naquela data. "Voltar ao normal" devolve o que a Programação manda. Quem pode: Administração e Supervisão do local; Direção só lê. Show não entra (nome e horário vêm do Livro do Show). Escala publicada marca "alterada depois de publicada" e avisa; dois navegadores: 409 com frase (`baseEditadaEm`). A chamada "X minutos antes" acompanha o horário novo. Rota `POST /escalas/dia/editar`; tabela `escala_bloco_edicoes`; teste `escala-editar-atividade-no-dia.test.ts`. **Fica de fora:** nome e tipo das atividades "só deste dia" (já têm "Mudar horário"). **Ordem para promover: migração 0087, depois API, depois site.**

- **28/10/2026, em produção (visto na conta, só leitura):** a API e o site com tudo até `c9b509b` estão no ar: "Snowland não abre quartas" aparece no dia fechado e "também na Acquamotion" na grade. Chamadas e "Editar neste dia" também.

## 10. Equipe por local na Programação (pacote O, decidido em 28/10/2026)

### O problema (visto na conta real em 28 e 29/10)
O app não sabe **em que local cada pessoa trabalha**. Para ele, "todo mundo" é o elenco inteiro e "Bailarinos" são todos os bailarinos,
de qualquer local. Daí vieram três defeitos que a usuária encontrou montando a Escala de verdade:
1. **Almoço:** a janela "todo mundo" de Snowland punha a galera da Acqua no almoço de Snowland (e vice-versa).
2. **Miguelito nos dois locais:** escalado em Snowland o dia todo, entrou também no Musical 13:30 da Acqua, porque está no elenco do
   Livro do Show de lá; ao gerar o dia, o Livro não sabia que ele estava em Snowland.
3. **Cada local lista as mesmas 32 pessoas**, e quem é do outro local aparece "sem nada" (mitigado em `c9b509b` com "No outro local").

A **Supervisão por local já existe e está certa** (Snowland: Vitinho, Deb, Rodrigo; Acqua: Tef nos Bailarinos). Não é preciso mexer nela.

### O que foi decidido (não reabrir)
- **A equipe mora dentro da Programação de cada local** (por temporada): a Programação de Snowland "Natal" diz quem trabalha em Snowland e
  em que dias da semana. Muda sozinha quando muda a temporada; o "Duplicar molde" copia a equipe junto.
- **Um dia pode ter horário (opcional):** "segunda, Snowland até 13:00" e "segunda, Acqua a partir de 14:00". Sem horário = o dia inteiro.
- **Blocos gerais** (só "todo mundo", "a área" e a janela de almoço) pegam **a equipe do local naquele dia e naquele horário**.
  Bloco de **grupo** (equipe cadastrada) e de **pessoas** escolhidas pelo nome **não filtram pelo local**: quem foi nomeado fica.
- **Shows** pegam o elenco do Livro **de onde for**, desde que a pessoa esteja **livre naquele horário**. Se tiver atividade no seu local
  na mesma hora, conta como indisponível (como folga) e entra a reserva; a tela diz por quê ("Miguelito está em Snowland das 08:40 às 17:00").
  Se estiver livre, vai, e a Escala mostra "vem da Snowland para o show".
- **Hotéis (Bella, Buona, Exclusive) não têm equipe**, em qualquer horário (há show de hotel de manhã): vale a regra dos shows.
- **Imprevisto do dia:** um clique na Escala ("trazer para cá hoje", "mandar para a Acqua hoje"), só naquela data, com motivo opcional,
  sem mexer na Programação. Entra no Registro e avisa a Supervisão do outro local. **Tem "a partir de" e "até" opcionais** (28/10):
  sem horário vale o dia inteiro; trazido às 15h, a pessoa não entra no almoço das 12h. **Se o outro local não tem Supervisão,
  o aviso vai para a Administração.**
- **Quem mexe:** a Administração em tudo; a Supervisão na equipe e nos imprevistos do **seu** local. Direção só lê; Elenco não vê a tela.
- **Pessoa sem nenhuma marca de equipe na temporada:** continua como hoje (aparece em todos os locais). Nada quebra antes de preencher.
- **A regra é por pessoa, não por dia** (28/10): quem tem marca em algum local na temporada e está **sem marca naquele dia** não entra em
  blocos gerais de nenhum local. Pode entrar em show, se estiver livre, e pelo imprevisto do dia. A Atenção do dia mostra
  **"Fulano sem local hoje"**.
- **Nada muda escondido** (28/10): em **rascunho**, os blocos gerais se recalculam sozinhos, mas o Livro do Dia só muda com
  "Refazer este dia" ou "Trazer as novidades". Em dia **publicado**, nada muda até a republicação, e a Administração é avisada de que há
  o que republicar (inclusive pelo Livro).
- **Mesma pessoa marcada em dois locais no mesmo dia e horário:** só avisa, nunca bloqueia (pode ser de propósito).
- **Tempo de deslocamento é configurável** (28/10): a Administração escreve, em Locais, quantos minutos leva de um local a outro; não espera a Babi.
- **Primeira vez:** o app **sugere** a equipe olhando as Escalas já feitas ("o Miguel teve atividade em Snowland às segundas, quartas e
  quintas"); a usuária confere e confirma. Marcar em lote: escolher várias pessoas e "Snowland, todos os dias".

### Passos (cada um entra no ar sozinho, nesta ordem)
| # | O quê | Onde | Migração |
|---|---|---|---|
| O1 | **Banco:** tabela `programacao_equipe` (programação, pessoa, dia da semana, de/até opcional, ativo), `escala_local_do_dia` (imprevisto: pessoa, data, local de destino, motivo, ativo) e `locais_deslocamento` (de um local a outro, minutos). Remoção lógica; rollback em `lib/db/drizzle/rollback/` | `lib/db` | **0088** |
| O2 | **API da equipe:** ler e gravar a equipe da Programação (em lote), com Registro e conferência de versão (409 com frase se outra pessoa salvou antes); sugestão a partir das Escalas já feitas; "Duplicar molde" leva a equipe; recusas em português (Supervisão de outro local, Direção, Elenco) | `routes/programacao`, `services` | — |
| O3 | **A regra na Escala do dia** (`montarEscalaDoDia`): blocos gerais ("todo mundo" e "área") só com a equipe do local e do horário; imprevistos do dia por cima; quem tem marca na temporada mas não naquele dia sai dos blocos gerais e aparece em "sem local hoje"; quem não tem marca nenhuma segue como hoje. A faixa "No outro local" passa a usar isso | `services/escala-dia.ts` | — |
| O4 | **A regra no Livro do Dia:** ao gerar o dia, quem tem atividade no seu local no horário do show conta como indisponível (`getUnavailableUserIds` ganha o horário) e a reserva entra; frase do porquê. Show de hotel segue a mesma regra | `services/line-resolver.ts`, geração do dia | — |
| O5 | **Choque entre locais e deslocamento** na Atenção do dia: a mesma pessoa em dois locais no mesmo horário, ou sem o tempo de ir de um ao outro ("Miguelito sai de Snowland às 13:00 e o show da Acqua é às 13:10; a ida leva 30 min"). **O tempo é configurável** em Locais, por par de locais (Snowland ↔ Acqua, Snowland ↔ Bella…), pela Administração; par sem tempo = só confere se cruza. Só avisa, nunca bloqueia; no Livro do Dia, quem não chega a tempo conta como indisponível e entra a reserva | `escala-dia`, `atencao-do-dia.tsx`, `locais.tsx` | — |
| O6 | **Tela da equipe:** aba "Equipe" na Programação de cada local: lista do elenco × 7 dias, marcar em lote, horário opcional por dia, botão "Sugerir pelas Escalas feitas", rodapé Cancelar/Salvar, Esc fecha; 375 e 1360 px | `pages/escalas.tsx` (aba Programação) | — |
| O7 | **Imprevisto na Escala do dia:** "Trazer para cá hoje" (na lista "No outro local") e "Mandar para outro local hoje" (no painel "Dia de Fulano"), com "a partir de" e "até" opcionais; desfazer; aviso no sino à Supervisão do outro local (Administração se o local não tem Supervisão); escala publicada marca "alterada depois de publicada" | `pages/escalas.tsx`, rota nova | — |
| O8 | **Conferência:** testes de API (equipe, regra dos blocos, Livro com horário, imprevisto, permissões, versões), bateria relacionada, tela nos 4 perfis a 375 e 1360, impressão por local | testes | — |

**Ordem para promover (quem constrói o app):** backup → migração 0088 → API → site. (Conferido em 28/10: a 0087, "Editar neste dia", já está aplicada em produção, então a 0088 é a próxima da fila.) Depois, montar a equipe de Snowland e da Acqua com a
sugestão automática e conferir uma quinta-feira real (o Miguelito só em Snowland; o almoço de Snowland sem a Acqua).

### Riscos e o que fica de fora
- **Desempenho:** a Escala do dia já faz uma leitura por local (`comOutrosLocais`); a regra do horário no Livro vai olhar a Escala do
  outro local. Medir no banco de teste e, se pesar, guardar o resultado do dia.
- **Escala já publicada** antes da equipe existir não muda sozinha: a mudança espera a republicação, como sempre (crivo 6).
- **Fora:** "uma escala só" com todos os locais na mesma grade (vem depois, com a equipe
  pronta); pessoa em duas áreas (Amanda e Antônio).
