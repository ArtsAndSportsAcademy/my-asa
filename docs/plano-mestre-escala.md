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
| 1 | **Promover** o que está na seção 2 e 3; depois renomear os tipos já existentes em produção (janela "Tipos de atividade"); "Trazer as novidades" no Teatro 11:30 e Boas Vindas do dia 22; "Refazer" no Opening de terça | — | 0085 | só quem constrói o app roda em produção; antes, `DB_POOL_MAX=3` na API (ver `docs/quando-o-app-cai.md`) |
| 2 | **F. Chamadas** (desenho aprovado em 27/10 em `docs/desenho-chamadas-escala.md`; **F1 construída e commitada localmente em 27/10**: migração 0086, rotas e leitura na Escala; faltam F2 editor e F3 telas e aviso) (várias por show, configuráveis; ocupa tempo ou só informativa; aviso; quem = Livro do Dia) | G | **0086** | **desenhar a tela de configuração antes** e mostrar à usuária |
| 3 | **Fase 2 do plano de construção: semana e equilíbrio** (gerar a semana; visão "Semana" só leitura com a contagem de shows de elenco limitado; interruptor "Conta para o equilíbrio" por show) | G | **0087** (era 0085 no plano antigo) | é o "plano esquecido" do rodízio por semana; **pergunta nova: qual a regra de "limitado"** |
| 4 | **G. Tempo disponível** (aviso a partir de 30 min, configurável em Locais) | M | **0088** | só Supervisão e Administração veem |
| 5 | **H. Etapa 8: copiar de outro dia** (mostra quem ficou de fora e por quê) | M | não | |
| 6 | **I. Formações no Livro do Dia** (criar do zero, renomear, arquivar) | M–G | talvez | conferir antes na tela com um show de mapa de palco |
| 7 | **J. Menos cliques** (cadastro de várias pessoas, ligar vários personagens ao show, repetir horários nas sessões, bloco em vários horários) | M cada | não | |
| 8 | **Fase 3: relatório do mês** | G | ? | só depois de um mês real de uso; definir o que entra e quem vê |

A numeração das migrações é a prevista; a primeira livre hoje é a **0086**.

## 5. Em espera (depende da Babi)
- **K. "Onde a pessoa trabalha no dia"** (Snow de manhã, Acqua à tarde, hotéis à noite), com choque considerando o **deslocamento entre parques** e os tempos entre Snow, Acqua e hotéis. A mensagem está pronta, mas a usuária ainda não quer enviar.
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
