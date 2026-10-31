# Plano mestre da Escala (atualizado em 30/10/2026)

Este é o **único plano vivo**. Os planos antigos ficam como histórico e detalhe:
- `docs/plano-de-construcao-escala-mais-facil.md` (24/10): as Etapas 0 a 8 e as Fases 2 e 3 (o que ele diz que "nada foi feito" está desatualizado).
- `docs/plano-proximos-passos-escala-2026-10-26.md` (26/10): os pacotes A a N e as decisões da usuária.

Regra de uso: o que mudar de estado muda **aqui primeiro**. Código só com o "pode começar" da usuária; envio ao GitHub só com o "pode enviar";
produção (backup, migração, API, site) é de quem constrói o app, nessa ordem.

## 0. Onde estamos (30/10/2026) — leia isto primeiro
- **H (copiar de outro dia, `e7c3cdb` e `ef2f83a`) e G (tempo disponível, `70ecf7a..2154d03`, migração 0090) estão prontos e conferidos, mas NÃO promovidos.** Ordem: backup, migração 0090, API, site.
- **"Tirar este show do dia", "Refazer os Livros deste dia" e o motivo opcional na cópia estão prontos (seção 14): só locais, nada enviado, sem migração.** Ordem para promover: API, depois site.
- **Tudo até `da985e4` está em produção** (ramo `codex/escala-mais-facil`; migrações da 0000 à **0089** aplicadas). Nada na `main`.
- **A próxima migração livre é a 0091** (a 0090 é a do G, já no banco de teste). Ao criar uma, escreva o rollback em `lib/db/drizzle/rollback/` e registre no `meta/_journal.json`.
- **A equipe por local (pacote O) está no ar, mas ainda vazia em produção:** até alguém preencher a equipe de Snowland e da Acqua na
  Programação, a Escala segue como antes. Preencher e conferir uma quinta-feira real é o primeiro passo (seção 2, item 1).
- **Como se trabalha agora:** a usuária constrói cada pacote numa sessão própria e traz para outra sessão **conferir** (ler o diff atrás de
  defeitos de regra, rodar os testes que tocam o que mudou, olhar a conta real só lendo, relatar do mais grave ao menos grave e corrigir só
  com o "corrija" dela). Quem constrói: ao terminar, diga o pacote e o intervalo de commits.

## 1. Feito e em produção
| O quê | Migração | Onde está o detalhe |
|---|---|---|
| Etapas 0 a 7 (Escala com cara de planilha, virada do dia por local, preencher em lote, tipos com cores, "Enviar minha parte", publicar com confirmação) | até 0084 | plano de construção |
| Livro do Dia: "Trazer as novidades", vagas editáveis, "Ver quem faz o quê", "Refazer este dia do zero" | — | plano de 26/10 |
| Defeitos A1 a A9, nomes de fábrica dos tipos (B), resumo "quem faz" (C), rodízio com rascunho (D) | — | plano de 26/10 |
| Bloco flexível (almoço em janela) e prioridade da atividade específica, cortando só o trecho que cruza (E) | 0085 | plano de 26/10 |
| "Conferido" saiu do app; a Escala abre por atividade (M + N); cabeçalho compacto no celular; folga vence na vaga do show | — | seção 9 |
| Chamadas (F1 a F3): várias por show, configuráveis; chamada do show na sessão | 0086, 0089 | `docs/desenho-chamadas-escala.md` |
| Editar a atividade só neste dia | 0087 | seção 9 |
| Folha impressa simples ("Elenco do dia", área pelo nome, "Pessoas de folga", "Editar este texto"), Guardião 1–8 em ordem | — | seção 9 |
| Visual da Escala: faixa do dia no topo (quem não trabalha à vista), tabela mais baixa | — | `57f012b`, `75c5f2e` |
| Local fechado no dia (Snowland às quartas) e "No outro local" | — | `c9b509b` |
| **O. Equipe por local** na Programação, imprevisto do dia, tempo de ida entre locais, choque entre locais, Livro do Dia que pula quem está em outro local; revisão de 30/10 (cada local mostra só a sua equipe; "todo mundo" do outro local conta como ocupado) | 0088 | seção 10 |

## 2. Falta fazer (ordem sugerida para entregar a Escala às Supervisões)
| # | Pacote | Tam. | Migração | Observação |
|---|---|---|---|---|
| 1 | **Preencher a equipe** de Snowland e da Acqua (Programação → "Equipe do local", marcar em lote ou "Sugerir pelas Escalas feitas") e conferir uma quinta-feira real: o Miguelito só em Snowland, o almoço de Snowland sem a Acqua, a grade sem colunas de gente da Acqua | — | — | **a usuária faz em produção**; quem confere só lê |
| 2 | ~~**H. Copiar de outro dia** (Etapa 8)~~ **feito** (H1 `e7c3cdb`, H2 `ef2f83a`; conferência de 30/10 abaixo): a Supervisão copia um dia que funcionou; o app mostra quem ficou de fora e por quê (folga, outra equipe, local fechado) | M | não (a confirmar) | **o próximo**, decidido em 30/10 (decisões 15 a 24 da seção 7). **H1** copia a Escala (atividades só do dia, ajustes por pessoa, horários, edições do dia, chamadas) para um ou vários dias do mesmo local; **H2** copia as vagas dos Livros do Dia. Começa pelo H1. **H1 e H2 feitos em 30/10 (local, sem migração; nada enviado). H1: seção 11. H2 (vagas dos Livros do Dia, `services/escala-copia-livros.ts`, `trocarVagasNoLivro` em `routes/daily-book.ts`):** copia quem faz cada personagem do Livro de origem para o Livro do mesmo show e da mesma sessão no destino, casando a vaga por cena, bloco e papel de origem. **Só copia num Livro que já existe no destino**; se não foi gerado, a prévia diz e a Administração gera. Passa pelas regras (folga, fora do elenco, restrição de horário, limite do dia, atividade em outro local); em show **não** vale "equipe de outro local" (show pega o elenco de onde for quando a pessoa está livre). Juntar não troca vaga que alguém já mudou à mão; a vaga copiada vira exceção do dia (manual); se a pessoa já estava em outra vaga do mesmo Livro, a outra abre. Supervisão do local também copia vagas. Vai no mesmo evento do Registro e o desfazer devolve só a vaga que ninguém mexeu. Copia o Livro **como está agora** (não há retrato confiável da versão publicada do Livro). Teste: `escala-copiar-vagas-do-livro.test.ts` |
| 3 | ~~**G. Tempo disponível**~~ **feito** (`70ecf7a..2154d03`, seção 12): aviso quando alguém fica 30 min ou mais sem nada no dia; só Supervisão e Administração veem; o limite é configurável em Locais | M | **0090** | decisão 4 da seção 7. **Decidido e desenhado em 30/10: ver a seção 12** (código ainda não começou) |
| 4 | **J. Menos cliques**: cadastro de várias pessoas, ligar vários personagens ao show, repetir horários nas sessões, bloco em vários horários | M cada | não | perguntar à usuária quais partes incomodam mais e fazer só essas |
| 5 | **"Uma escala só"**: visão "Todos os locais" na Atividade do dia (a linha do dia de cada pessoa com o local de cada atividade) | G | não | desenhar antes; depende da equipe preenchida |
| 6 | **I. Formações no Livro do Dia** (criar do zero, renomear, arquivar) | M–G | talvez | conferir antes na tela com um show de mapa de palco |
| 7 | **Fase 3: relatório do mês** | G | ? | só depois de um mês real de uso |
| — | **Trocar "folga" e "férias" por "No show" e "Recessos"** em todo o app | G | talvez | **sessão própria** (decisão de 27/10): telas, avisos, Registro e textos; a regra "folga vence a escala" continua, só muda o nome |

## 3. Em espera ou por decidir
- **Fase 2 (semana e equilíbrio):** espera a Babi dizer a regra de "limitado" (quais shows contam para o equilíbrio). Migração: a primeira livre na hora.
- **Pessoa em duas áreas** (Amanda e Antônio): dependia da equipe por local, que já existe. Falta conversar com a usuária como fica.
- **Renomear "Escala do dia" para "Atividade do dia"** no resto do app (Livro do Dia, Solicitações, Registro, avisos): a aba e a folha já mudaram; o resto espera a decisão dela.
- **Para decidir depois:** "saída 13:30" na Minha escala vem do fim da janela do almoço, que não é a saída real da pessoa; com a "Atenção do dia" aberta, a grade a 375 px começa a ~400 px do topo.
- **Almoço com horário dividido:** quem tem "Snowland até 11:30" e "Acqua a partir de 12:30" cruza as duas janelas de almoço e aparece nos dois (só avisa; ver seção 10).

## 4. Não visto (vale para quem confere)
- A equipe preenchida de verdade, o imprevisto do dia, o choque entre locais e o Livro do Dia com equipe, em produção.
- Toque em aparelho de verdade e o app instalado (PWA).
- O tempo para gerar um dia em produção com a equipe ligada (no banco de teste cada Escala leva ~7 s; produção não foi medida).

## 5. Comandos e contas de teste
Os comandos que funcionam nesta máquina estão no `AGENTS.md` (tipos, build, verificação de nomes, testes da API um arquivo por vez,
migração no banco de TESTE). Para ver a tela com dados de verdade, a empresa de teste e o auxiliar de login estão em
`docs/prompt-continuar-escala-2026-10-27.md` (seção 4); para ver sem servidor, `?amostra=1` com `sessionStorage["myasa-review-role"]`
(`adm`/`sup`/`dir`/`mem`) e as chaves de amostra `&fechado=1`, `&outro=1`, `&equipe=1`, `&choques=1`.

## 6. Histórico desta parte
Até 28/10 este plano listava o que estava "enviado e não promovido" e "commitado e não enviado". Tudo isso está em produção desde
28 a 30/10 (seção 1); o detalhe de cada commit fica no `git log` do ramo.

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
12. **Equipe por local** (28/10): mora na Programação de cada local, por temporada; tudo o que está na seção 10, "O que foi decidido".
13. **Tempo de ida entre locais é configurável** em Locais, pela Administração (28/10).
14. **Quem não tem marca de equipe não é barrado no Livro do Dia** por estar num bloco de "todo mundo" ou de área de outro local (30/10): ela está nesses blocos em todos os locais, então eles não dizem onde ela está. Para quem tem marca, esses blocos contam como ocupado.

15. **Copiar de outro dia (H), dividido em duas partes** (30/10): **H1** copia a Escala; **H2** copia as vagas dos Livros do Dia. Nas duas, Administração e Supervisão do local têm as mesmas permissões; publicar continua só da Administração. No H2, copiar vagas de Livro passa a valer também para a Supervisão do local (hoje gerar Livros é só da Administração), com Registro. Direção só lê; Elenco não vê.
16. **Destino que já tem ajustes:** juntar, sem mexer no que já está. "Começar do zero" existe, mas não como botão principal: pede motivo escrito e é restaurável (nada é apagado).
17. **Destino já publicado: permitir.** Marca "alterada depois de publicada", avisa a Administração para republicar, o Elenco segue vendo a versão antiga; faixa amarela avisa antes de copiar.
18. **Origem de outro dia da semana: permitir**, casando por nome e horário e listando o que não casou.
19. **Qual versão da origem:** a publicada, quando houver. Se a origem mudou depois de publicada, avisa e pergunta qual das duas copiar. Nunca publicada: copia o rascunho.
20. **Só dias do mesmo local.**
21. **Desfazer a cópia:** na faixa logo depois de copiar e no Registro, enquanto ninguém mexeu nesses itens; se alguém já mexeu, o app diz o que não dá para desfazer.
22. **A cópia respeita a equipe por local** (seção 10): no destino, quem é da equipe de outro local ou está sem local não entra e aparece em "ficam de fora" com o motivo ("é da equipe da Acqua neste dia"). Folga e local fechado também são motivos. Quem precisar, a Supervisão traz pelo imprevisto do dia.
23. **Vários dias de destino de uma vez** (ex.: esta quinta para as próximas 3 quintas).
24. **Um aviso por cópia** (não um por item) e, no Registro, **um evento por dia copiado**, dizendo de onde veio e o que ficou de fora.

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

**Andamento (29/10/2026), O8 (conferência com a API de verdade, na empresa de teste):** subi a API contra o banco de teste (porta 3001, `DB_POOL_MAX=3`) e o site com proxy, entrei com as contas `teste.*` (Administração, Supervisão de Patinadores e de Bailarinos, Direção e Elenco) por um servidor local temporário que faz o login sem a senha passar pela conversa, e usei as telas e as rotas como cada perfil. No fim desliguei tudo e devolvi a empresa de teste ao que era (equipe, tempo de ida e blocos de teste retirados sem apagar nada; as Escalas de 31/10 que criei para a conferência ficaram republicadas).
- **Equipe (API real):** a janela abre com as 31 pessoas; "Sugerir pelas Escalas feitas" leu 4 Escalas publicadas e sugeriu 10 pessoas; "Marcar o sugerido" + "Salvar equipe" gravou 27 marcações. Com a equipe marcada, a Atenção do dia mostrou "10 pessoas sem local hoje". **Regra nos blocos reais** (sábado 31/10, bloco "todo mundo" nos dois locais, Pessoa 1 marcada só no R4, Pessoa 2 só no Snowland, Pessoa 3 sem marca): R4 = Pessoa 1 e Pessoa 3 (30 pessoas), Snowland = Pessoa 2 e Pessoa 3 (30 pessoas).
- **Imprevisto com Escala publicada, pelas telas:** "Trazer para cá hoje" (a Pessoa 2 aparecia em "No outro local · Snowland 12:00–13:00") gravou; as duas Escalas publicadas ficaram "mudou depois de publicada"; **o sino** (lido como cada pessoa, `GET /notifications`) trouxe `escala.local_do_dia` à Supervisão de Patinadores (a da área da Pessoa 2, porque a Administração mexeu) e `scale.needs_republish` à Administração e às duas Supervisões; **antes de republicar**, "Minha escala" da Pessoa 2 seguiu mostrando só o Snowland (versão publicada); **republicados pela tela** (R4 e Snowland), a Pessoa 2 passou a ver o R4 e saiu do bloco do Snowland (ficou só o Musical); a Pessoa 1 não mudou. Desfazer pela tela devolveu a pessoa a "sem local" (conferido também com o cartão "Sem local hoje").
- **Tempo de ida (tela real):** a janela abriu com o par R4 ↔ Snowland; dois editores ao mesmo tempo deram o **409** com a frase "Outra pessoa alterou…" e o campo passou a mostrar o valor novo; salvar 25 min gravou; a Direção lê 25 e não edita. **Choque real:** com ida de 25 min, a Pessoa 2 no ensaio das 13:00 do R4 depois do Musical do Snowland até 13:00 apareceu como "sem tempo" (ida 25, folga 0), com a frase certa, a 1360 e a 375 px.
- **Perfis:** Supervisão de Patinadores e de Bailarinos editam a equipe (as duas cuidam dos dois locais da empresa de teste); a Direção só lê (a 375 px: "somente leitura", sem nenhum botão de mexer, sem rolagem lateral) e recebe 403 com frase ao gravar tempo de ida ou mudar alguém de local; o Elenco não vê a aba Programação, recebe 403 com frase nas três rotas e vê só "Minha escala" a 375 px. A impressão do local abriu com a equipe ativa; o Livro do Dia de 31/10 abriu sem erro. Uma Supervisão **sem** acesso a um local não existe nessa empresa: esse caso (403 com frase) está só no teste da API (`escala-equipe`, `escala-imprevisto-de-local`).
- **Defeitos achados e corrigidos nesta conferência:** (1) a janela da Equipe passava por baixo do menu lateral a 1360 px (menu em z-index 60, fundo padrão da janela em 50: as duas janelas novas passam a ter 90); (2) quem estava em "Sem local hoje" não tinha como ser resolvido ali: o cartão ganhou "Trazer para cá hoje" por pessoa; (3) o texto da janela do imprevisto prometia um aviso que nem sempre existe; (4) a célula do dia no celular passou de 34 para 38 px; (5) a **bateria completa** (`block6-integrity`, que exige toda rota nova chamada com todos os perfis) reprovou `/locations/deslocamento`: o teste agora cobre os cinco perfis (37 de 37 rotas, 185 de 185 combinações); (6) os cinco testes do pacote O não estavam na lista padrão da bateria e passaram a estar em `run-tests.mjs`.
- **Desempenho (medido no banco de teste, em que uma ida ao banco leva ~220 ms e a Escala do dia ~7 s):** a leitura da equipe e dos imprevistos custava ~430 ms por pedido e por local; agora é **uma** consulta (~230 ms) lida junto das outras, o tempo de ida é lido em paralelo, e **Minha escala, painel do ciclo e análise de folga** (que montam vários locais na mesma data) leem a casa **uma vez** e passam adiante (`leituraDaCasaNoDia`). O que o pacote O soma ao pedido principal ficou em ~1 ida ao banco (~3% de 7 s); o resto já era assim. **Produção não foi medida** (só leitura lá, e o banco de teste é lento por natureza).
- **Bateria completa (91 arquivos, os 86 de sempre + os 5 do pacote O):** leva mais de 3 horas contra o banco de teste (cada teste espera o banco). A primeira rodada foi interrompida por uma queda da sessão e pelo limite de 15 conexões (`EMAXCONNSESSION`: não é defeito do app; por isso a API de conferência usa `DB_POOL_MAX=3` e nada roda no banco junto com a bateria). A segunda, inteira, deu **87 de 91**; as 4 falhas tinham causa conhecida e estão corrigidas: (1) `escala-deslocamento` e `escala-imprevisto-de-local` contavam eventos do Registro no banco de teste inteiro (as minhas conferências com a API real deixaram eventos lá): agora contam só os da própria casa, e isso revelou um **defeito real**, os eventos `escala.alterada_pela_equipe` e `escala.alterada_pelo_imprevisto` eram gravados **sem a casa** (`orgId`) e podiam não aparecer no Registro de quem os vê: corrigido em `escala-equipe-aviso.ts`; (2) `fase-d-seguranca` esperava 403 para a Supervisão de Patinadores mexer na escala de uma pessoa de Bailarinos no mesmo local, mas a decisão de 25/10/2026 liberou isso: expectativa atualizada, e a limpeza do teste passou a apagar os avisos que ele gera; (3) `asa-capabilities` lê o código da ASA com um padrão que só serve para fim de linha LF e este checkout usa CRLF: a leitura ficou tolerante (nada a ver com o pacote O). Depois disso reli, um a um e com o código final, os testes que tocam o que mudei (escala-equipe, escala-equipe-regra, escala-deslocamento, escala-imprevisto-de-local, livro-equipe-outro-local, permission-matrix, block6-integrity, restricao-horario, escalas-dia, escala-horario-da-pessoa, escala-mes, daily-book-vivo, folga-analise, fase-c-meu-dia, fase-c-escala-avisos, grupo-b-operational-cycle, fase-d-seguranca, asa-capabilities): **todos passam**. `tsc` da API e do site limpos, build e verificação de nomes (D1) sem achados; testes do site 17 de 17.
- **Não coberto por falta de meio:** produção (só leitura) e push de verdade (o sino foi conferido pela fila entregue sem push); Supervisão sem acesso a um local, só no teste da API.

**Andamento (29/10/2026), O7:** o imprevisto de local do dia está no ar (API e tela), sobre a tabela `escala_local_do_dia` da 0088.
- **API:** `POST /escalas/dia/local-do-dia` (`locationId` = local da tela, `destinoId` = onde a pessoa trabalha no dia, `origemId` opcional = onde ela estaria, `userId`, `date`, `inicio`/`fim` opcionais, `motivo` opcional) e `POST /escalas/dia/local-do-dia/desfazer` (`id`, `locationId`). Quem pode: Administração, ou a Supervisão do destino ou da origem; desfazer: Administração, Supervisão do destino ou quem criou. Direção e Elenco recebem 403 com frase. Recusas com frase: dia fechado no destino (409 `LOCAL_FECHADO`), **pessoa de folga** (409 `PESSOA_DE_FOLGA`: folga vence a escala, só o Ajustar com motivo escrito), horário com fim antes do início, destino igual à origem. Repetir o mesmo imprevisto não grava nem avisa de novo. Nada é apagado: desfazer deixa a linha inativa.
- **Registro:** `escala.local_do_dia_criado` (com a origem e o motivo) e `escala.local_do_dia_desfeito`.
- **Aviso no sino** (`escala.local_do_dia`, um por imprevisto e destinatário): vai à Supervisão do **outro** local (quem mexeu e supervisiona um lado não recebe o próprio aviso; pela área da pessoa quando há, senão qualquer Supervisão do local). Se nenhum dos locais envolvidos tem Supervisão a avisar, vai para a Administração. Quando a Administração mexe, a Supervisão dos dois locais é avisada. Desfazer **não** manda aviso ao sino (só Registro e a marca de republicação).
- **Escala já publicada:** `services/escala-equipe-aviso.ts` (`marcarEscalasDoDiaPeloImprevisto`) confere as Escalas publicadas daquela data nos locais envolvidos; só as que deixaram de bater ficam "alteradas depois de publicada" (Registro `escala.alterada_pelo_imprevisto`, aviso à Administração). O Elenco segue vendo a versão publicada. Se a conferência falhar, o imprevisto fica salvo e o erro vai para o log.
- **A Escala do dia** devolve `imprevistos` (os vivos da data, com local, horário, motivo e quem fez); a regra em si já valia desde o O3.
- **Tela:** "Trazer para cá hoje" ao lado de quem está em "No outro local" e "Mandar para outro local hoje…" no painel "Dia de {pessoa}" (só quem pode mexer; não aparece para quem está de folga), com a janela `local-do-dia-dialog.tsx` (horário opcional, motivo opcional, rodapé Cancelar/Confirmar, Esc fecha, a frase do servidor fica na janela e rola até ela no celular). O cartão "Mudanças de local só de hoje" na Atenção do dia lista cada uma com o botão **Desfazer**; também há "Desfazer" na faixa que aparece logo depois de confirmar. Visto no navegador em modo de amostra (`?amostra=1&choques=1`) com Administração a 1024 e 375 px e Direção só lendo.
- **Não visto:** a tela contra a API real (a API foi testada à parte), a Supervisão na tela, e o fluxo completo "trazer" e "desfazer" com dados de verdade. Teste: `escala-imprevisto-de-local.test.ts`.

**Andamento (29/10/2026), O6:** a tela da equipe existe. Na aba Programação, o botão **"Equipe do local"** (na faixa do molde, para quem vê a aba) abre a janela `components/escala/equipe-dialog.tsx`, em vez de uma aba separada: assim ela herda o miolo que rola e o rodapé sempre à vista da janela do Ajustar.
- **Grade:** pessoas × Seg…Dom (o servidor guarda 0 = domingo), um botão por dia; busca por nome e filtro por área. Tocar no nome abre o detalhe, com "a partir de" e "até" por dia e "outra janela neste dia" (a marca ◐ e "com horário" aparecem quando há horário; sem horário = dia inteiro; fim antes do início é recusado na hora).
- **Lote:** escolher pessoas (ou "Escolher as da lista"), escolher os dias (atalhos "Todos os dias", "Segunda a sexta", "Fim de semana") e "Marcar em {local}" ou "Tirar dos dias escolhidos".
- **Sugerir pelas Escalas feitas:** mostra o que a API leu ("Li N Escalas publicadas…") e as frases por pessoa; "Marcar o sugerido" só leva para a grade, nada é gravado até o "Salvar equipe". Sem histórico, a janela diz isso em vez de ficar vazia.
- **Salvar:** manda a grade inteira com a versão que abriu. Rodapé com a contagem ("5 marcações novas · 1 retirada"), Cancelar e Salvar equipe; Esc, ×, Cancelar e toque fora perguntam antes de descartar o que ainda não foi salvo. Se outra pessoa salvou antes (409), a grade passa a mostrar o que está valendo e a frase do servidor continua na tela. A Direção só lê (sem caixas, sem botão de salvar, "Fechar").
- **Visto no navegador** (modo de amostra, com o servidor temporário do worktree): Administração a 1024 e 375 px (marcar em lote, horário por dia, descartar com Esc, tudo dentro da tela, rodapé visível) e Direção só leitura. **Não visto** contra a API real nem com a Supervisão; a API em si foi testada no O2.
- Uma coisa a saber: a célula do dia no celular fica com cerca de 34 px de largura (7 colunas em 375 px) e 44 px de altura.

**Andamento (29/10/2026), O5:** o tempo de ida entre locais e o choque entre locais estão no ar no worktree.
- **Tempo de ida (API):** `GET` e `PUT /locations/deslocamento` (`routes/areas-locations.ts`, `services/escala-deslocamento.ts`), sobre a tabela `locais_deslocamento` da 0088. Lê: Administração, Direção e Supervisão. Grava: só a Administração, o conjunto inteiro, com `baseVersao` (409 `VERSAO_MUDOU` com frase e o que está valendo). O par entra na ordem canônica (menor id primeiro), o que some da lista fica inativo (nunca apaga) e o que volta reativa a mesma linha. Registro `locations.deslocamento_alterado`, dizendo o par e o tempo.
- **Tela:** botão "Tempo de ida entre locais" em Cadastros → Locais (Administração grava; Direção só lê), janela com um campo de minutos por par, rodapé Cancelar/Salvar, Esc fecha, vista a 375 e 1280 px. Campo vazio = a ida não importa.
- **Choque na Escala do dia:** `choquesEntreLocais` na resposta, por pessoa: `mesmo_horario` (os horários se cruzam) ou `sem_tempo` (a folga é menor que a ida, com as duas contas). Mesmas exclusões da faixa "No outro local" (fora almoço, "todo mundo" e chamadas). Só vem quando a casa já usa equipe e só avisa. A Atenção do dia ganhou dois cartões: "Pessoa que não cabe em dois locais" e "Sem local hoje" (o `semLocalHoje` do O3). Para rever a tela com dados de exemplo: `?amostra=1&choques=1`.
- **Livro do Dia:** a regra `ATIVIDADE_EM_OUTRO_LOCAL` do O4 passa a considerar a ida: quem tem atividade em outro local e não chega a tempo ao show é barrada ("não chega a tempo: tem Treino em Snowland (09:00–11:00) e a ida leva 30 min, mas sobram só 15"), e a reserva entra.
- Fora deste passo: resolver o choque com um clique ("mandar para outro local hoje") é o O7. Teste: `escala-deslocamento.test.ts`.

**Andamento (29/10/2026), O4:** o motor do Livro do Dia ganha a regra `ATIVIDADE_EM_OUTRO_LOCAL` em `carregarRegrasDoDia` (`services/regras-de-escala.ts`), ao lado da restrição de horário e do limite do dia, então vale na geração, na releitura ao vivo e na troca à mão. Quem tem atividade em OUTRO local no horário do show (a Escala do dia dos outros locais, com as mesmas exclusões da faixa "No outro local": fora o almoço, os blocos de "todo mundo" e as chamadas) é barrado como na folga, o rodízio pula e a reserva entra; a frase diz onde ("está em Snowland nesse horário (Treino, 09:30–11:00)"). A mexida à mão passa escrevendo o motivo (409 `PESSOA_EM_OUTRO_LOCAL`, já aceito pela tela). **Só liga quando a casa já tem alguma marca de equipe ou imprevisto naquele dia**; sem equipe, nada muda e nada é lido a mais. Show de hotel segue a mesma regra, porque olha a atividade e não a equipe do hotel. Correção do O3 no mesmo passo: bloco sem horário de fim conta como um ponto no início (antes valia até o fim do dia, e uma marca "a partir de 14:00" cruzava um bloco das 08:00 sem fim). Ainda não feito: o tempo de deslocamento entre locais (O5). Custo: a geração de cada Livro passa a montar a Escala dos outros locais; medir no primeiro mês real. Teste: `livro-equipe-outro-local.test.ts`.

**Andamento (29/10/2026), O3:** a equipe passa a valer na Escala do dia (`services/escala-equipe-regra.ts`, ligada em `montarEscalaDoDia`). Só os blocos "todo mundo" e "área" (inclusive a janela de almoço) olham a equipe; grupo, pessoas e show não filtram. A marca da pessoa vem da Programação **vigente naquele dia em cada local** (a de vigência mais curta), então a regra por pessoa enxerga todos os locais de uma vez. A janela da marca precisa **cruzar** o horário do bloco (bloco sem fim conta como um ponto). O imprevisto (`escala_local_do_dia`) vale por cima no horário que cobre: ali a pessoa fica onde ele diz e nos outros locais não entra. A resposta ganha `semLocalHoje: string[]` (ids; só vem quando há alguma equipe marcada) para a Atenção do dia escrever "Fulano sem local hoje" no O5. Bloco geral que fica sem ninguém por causa da equipe diz isso no `sinal`. **Aviso de republicação:** ao salvar a equipe, `services/escala-equipe-aviso.ts` confere as Escalas **já publicadas dos próximos 30 dias, de todos os locais**; só as que de fato deixaram de bater com a publicação ficam "alteradas depois de publicada" (Registro `escala.alterada_pela_equipe`, aviso à Administração, um por publicação). O Elenco segue vendo a versão publicada. Se a conferência falhar, a equipe fica salva e o erro vai para o log. Ainda **não** muda o Livro do Dia (O4). Teste: `escala-equipe-regra.test.ts`. Limite conhecido: no almoço (janela de 11h às 13h) quem tem "Snowland até 11:30" e "Acqua a partir de 12:30" cruza as duas janelas e aparece nos dois almoços; só avisa, o bloco flexível nunca gera choque.

**Andamento (29/10/2026), O1 e O2:** O1 pronto (`20fed67`, migração 0088 só no banco de teste). O2 pronto (`7458c8b`). Contrato da API da equipe, para o O3 e o O6:
- `GET /programacoes/:id/equipe` → `{ equipe: [{id, userId, weekday, inicio, fim}], versao, pessoas: [{id, nome, areaId, areaNome}], podeEditar }`. Lê: Administração, Direção, Supervisão do local.
- `PUT /programacoes/:id/equipe` com `{ baseVersao, linhas: [{userId, weekday, inicio?, fim?}] }` grava **o conjunto inteiro** (a grade pessoa × dia). `baseVersao` é obrigatório (`null` se a equipe estava vazia). Só mexe no que mudou, o que sai fica inativo e o que volta reativa a mesma linha. 409 `VERSAO_MUDOU` com frase e a equipe nova; 400 se a pessoa não é do elenco (quem tem área e está ativo). Grava: Administração e Supervisão do local. **Desfazer = mandar o conjunto anterior.**
- `GET /programacoes/:id/equipe/sugestao` → quem teve atividade **própria** do local nas Escalas publicadas das últimas 8 semanas (bloco chamado para 80% ou mais de quem foi convocado no dia conta como "de todo mundo" e não prova nada; um dia é sugerido quando a pessoa tem atividade própria em pelo menos metade das Escalas publicadas daquele dia da semana). Só sugere, não grava.
- `POST /programacoes` com `copiarDeId` ("Duplicar molde") leva a equipe junto (quem saiu do elenco fica de fora) e responde `equipe: <quantas marcações>`.
- A versão da equipe é o instante da última mexida nas marcações, **não** `programacoes.version` (renomear a temporada não briga com quem edita a equipe). Corrige o que o plano dizia antes: os blocos não usam `programacoes.version`, usam o próprio "atualizado em".
- O O2 sozinho não muda a Escala nem o Livro do Dia: a equipe passou a valer na Escala no O3 (e vale no Livro no O4). O aviso de "há o que republicar" nasceu no O3.

**Ordem para promover (quem constrói o app):** backup → migração 0088 → API → site. (Conferido em 28/10: a 0087, "Editar neste dia", já está aplicada em produção, então a 0088 é a próxima da fila.) Depois, montar a equipe de Snowland e da Acqua com a
sugestão automática e conferir uma quinta-feira real (o Miguelito só em Snowland; o almoço de Snowland sem a Acqua).

**Revisão de 30/10/2026 (`da985e4`, em produção):** a conferência achou e corrigiu cinco problemas que só aparecem com a equipe preenchida:
(1) cada local continuava listando o elenco inteiro: agora a Escala marca `foraDoLocal` em quem é da equipe de outro local e não tem nada ali,
e a grade, as contagens, a impressão e o resumo deixam essa pessoa de fora (ela aparece em "No outro local"); (2) o Livro do Dia, o choque e a
faixa "No outro local" ignoravam o "todo mundo" do outro local: agora uma regra só (`contaComoAtividadeDe`) faz "todo mundo" e área contarem
para quem tem marca (decisão 14 da seção 7); (3) gerar o dia remontava os outros locais a cada Livro: agora uma vez por geração; (4) o
cabeçalho dos dias e a barra do lote ficam fixos na janela da equipe; (5) a vigência mostra o ano.

### Riscos e o que fica de fora
- **Desempenho:** a Escala do dia já faz uma leitura por local (`comOutrosLocais`); a regra do horário no Livro vai olhar a Escala do
  outro local. Medir no banco de teste e, se pesar, guardar o resultado do dia.
- **Escala já publicada** antes da equipe existir não muda sozinha: a mudança espera a republicação, como sempre (crivo 6).
- **Fora:** "uma escala só" com todos os locais na mesma grade (vem depois, com a equipe
  pronta); pessoa em duas áreas (Amanda e Antônio).

## 11. Copiar de outro dia, H1 (30/10/2026, local, sem migração, nada enviado)
- **Serviço** `services/escala-copia.ts`; **rotas** em `routes/escalas.ts`: `GET /escalas/copia/origens` (dias do local com algo para copiar), `POST /escalas/dia/copiar` (UM dia de destino por pedido; `simular: true` é a prévia e não grava) e `POST /escalas/dia/copiar/desfazer` (`eventoId`). Quem pode: Administração e Supervisão com acesso ao local; Direção e Elenco recebem 403 com frase.
- **O que copia:** atividades só do dia (com as pessoas), ajustes por pessoa, horário só de uma pessoa, edição da atividade no dia e chamadas das atividades só do dia. **Não copia:** chamada na folga (o motivo era daquele dia), imprevisto de local, "saiu do show", horários pedidos em Solicitações, marcas de parte enviada. Ajustes em atividades de show ficam para o **H2** (a prévia diz quantos são).
- **Regras no destino:** folga, equipe de outro local, "sem local hoje" e quem saiu do elenco ficam de fora, com a frase; local fechado pula o dia; destino publicado marca "alterada depois de publicada", avisa a Administração e o Elenco segue vendo a versão antiga. Atividade de outro dia da semana casa por nome e horário; a que não casa vai para "ficam de fora".
- **Juntar** (padrão) não mexe no que o destino já tem. **Começar do zero** pede motivo, desativa (não apaga) o que havia e o desfazer devolve.
- **Versão da origem:** a publicada quando houver (reconstruída pelos registros ativos no instante da publicação); se a origem mudou depois, a tela pergunta e o servidor recusa sem a escolha.
- **Registro:** um evento `escala.copiada_de_outro_dia` por dia copiado (de onde veio, o que ficou de fora, ids criados) e `escala.copia_desfeita`. **Avisos:** um por dia copiado (o de "quem mexeu em pessoa de outra área" e o de republicação), não um por item.
- **Tela:** `components/escala/copiar-dia-dialog.tsx`, no menu "Mais" do rodapé; escolher origem, dias de destino (até 8), o que copiar, conferir (prévia por dia) e copiar em fila; faixa "Desfazer cópia" depois. Teste: `escala-copiar-de-outro-dia.test.ts`.
- **Limites conhecidos:** o desfazer fica só na faixa (o botão no Registro não foi feito; a rota já aceita o `eventoId`); copiar de novo "juntando" uma atividade só do dia que já existe com pessoa nova pode repetir a chamada dela; a "versão publicada" da origem é uma reconstrução aproximada para atividades só do dia (usa a hora da última mexida).

## 12. G. Tempo disponível (decidido em 30/10/2026; código pronto em `70ecf7a..2154d03`, conferido; migração 0090, ainda não promovido)

### Decisões (não reabrir)
1. **O que é:** buraco entre duas atividades da mesma pessoa no mesmo dia, igual ou maior que o limite do local. O dia da pessoa vai da **primeira à última** atividade; antes da primeira e depois da última não é tempo disponível. Quem tem uma atividade só (ou nenhuma) não gera aviso.
2. **Conta como ocupado:** a janela de almoço **inteira**; a **ida entre locais** (desconta o tempo de ida cadastrado em Locais; sem tempo cadastrado vale 0); chamada que "ocupa tempo" (a só informativa não conta); atividade sem fim dura 30 min (como no choque entre locais). Folga, "equipe de outro local" e "sem local hoje" não geram aviso. Blocos "todo mundo" e de área seguem `contaComoAtividadeDe` (a mesma regra do choque).
3. **Buraco entre dois locais:** aparece **só no local onde começa**, com o limite desse local.
4. **Dia dividido:** buraco de **3 horas ou mais** sai da lista principal e vai para uma linha recolhida "Dia dividido (N pessoas) · ver quem". Na lista principal, do maior para o menor (correção de 30/10: "menores primeiro" queria dizer só que os buracos comuns vêm antes da linha de dia dividido).
5. **Lista principal:** mostra os **5 maiores buracos** (de 30 min até menos de 3 h) e "ver todos". Uma linha por buraco: quem tem dois buracos aparece em duas linhas.
6. **Quem vê:** Administração e Supervisão (esta vê pessoas de **outras áreas**, com o nome da área). **Direção e Elenco não veem**, e o servidor nem envia o campo a eles.
7. **Configuração:** Cadastros → Locais, só a Administração muda ("ligar/desligar" e "minutos"), com Registro; Supervisão e Direção só leem. Os locais que já existem começam **ligados, com 30 min**.
8. **Não vai para o sino, nem para a impressão, nem para a grade.** É alerta de tela.
9. **"Tempo livre" antigo da ASA** (`consultar_tempo_livre`, módulo `scales`, limite fixo de 60 min): fica como está. **Os números da ASA e os da Escala nova podem não bater.**

### Desenho
- **Banco (0090):** em `locations`, `tempo_disponivel_ligado boolean not null default true` e `tempo_disponivel_minutos integer not null default 30`. Rollback em `lib/db/drizzle/rollback/`, registro no `_journal.json`, aplicada só no banco de teste.
- **Serviço puro** `services/escala-tempo-disponivel.ts`: junta, por pessoa, as atividades que ocupam (inclui almoço-janela e a ida), ordena, funde as que se encostam e devolve os buracos ≥ limite, cada um com `pessoaId`, `de`, `ate`, `minutos`, a atividade de antes e a de depois, e, quando a seguinte é em outro local, o nome dele. Reaproveita `minutosDe`, `horaDe`, `contaComoAtividadeDe` e o tempo de ida.
- **Escala do dia:** `EscalaDia` ganha `tempoDisponivel?: { limite: number; avisos: …[]; diaDividido: …[] }`, montado ao lado de `choquesEntreLocais` com as mesmas Escalas dos outros locais; só vem para Administração e Supervisão e só com o local ligado. A rota passa o perfil (mudança pequena em `routes/escalas.ts`).
- **Locais:** `PUT /locations/:id/tempo-disponivel` (só Administração, com Registro `location.tempo_disponivel_alterado`, mínimo 5 e máximo 240 min) e leitura junto da lista de locais; janela pequena em Cadastros → Locais, ao lado da virada do dia (rodapé Cancelar/Salvar, Esc fecha).
- **Tela:** cartão "Tempo disponível" na Atenção do dia (5 maiores + "ver todos"; linha recolhida "Dia dividido"); linha "Livre das X às Y" no painel "Dia de Fulano" com botão para adicionar atividade; resumo do cabeçalho ganha "N pessoas com tempo disponível". Conferir a 375 e 1360 px, com os quatro perfis.
- **Teste:** `escala-tempo-disponivel.test.ts` (contas do serviço puro; perfis que não recebem o campo; ligar/desligar; recusa com frase; Registro).
- **Não visto ainda:** a janela da virada em Locais e o painel "Dia de Fulano" por dentro; produção; desempenho (deve reaproveitar o que o choque já carrega).

## 13. Conferência de H e G (30/10/2026)
Lido o código dos três pacotes; testes com o código final, um arquivo por vez: `escala-copiar-de-outro-dia` (50), `escala-copiar-vagas-do-livro`
(26), `escala-tempo-disponivel` (63); a sessão do G rodou também escalas-dia, deslocamento, equipe, imprevisto, horário da pessoa, virada do
dia, permission-matrix e block6. `tsc` da API limpo. Vista na tela, com a API de teste e a Supervisão de Patinadores: a janela "Copiar de outro
dia" (origens, "os próximos 3", conferência de 4 sábados, cópia de 22 itens, "Desfazer cópia") a 1360 e 375 px.

**Achados (todos corrigidos na mesma data, ver o fim desta seção):**
1. **Desfazer depois de publicar muda o dia publicado sem avisar.** Se a cópia foi para um rascunho e o dia foi publicado depois, o
   "Desfazer cópia" tira os itens sem marcar "alterada depois de publicada" nem avisar a Administração (crivo 6). O desfazer de uma cópia em
   dia já publicado também não avisa. `desfazerCopia` em `services/escala-copia.ts`.
2. **H2: a vaga trocada à mão entre a conferência e o "Copiar" é sobrescrita.** O comentário diz que a gravação usa a versão do Livro que a
   conferência leu, mas `trocarVagasNoLivro` lê a versão de novo dentro da transação; então não há 409 se alguém mexeu no meio (crivo 19).
3. **Desfazer que deu certo não diz nada:** a faixa some sem "Desfiz a cópia de 4 dias" (crivo 14). Só aparece frase quando falha.
4. **Durante a gravação a janela segue dizendo "Nada foi gravado ainda."** enquanto mostra "Copiando 2 de 4…" (crivo 13).
5. **"Este e as próximas 3 sábados":** sábado e domingo são masculinos ("os próximos 3 sábados").
6. **No celular a janela de cópia encosta na borda direita** (16 px à esquerda, 0 à direita).
7. **Tempo:** a conferência de 4 dias levou ~50 s e a cópia ~15 s por dia no banco de teste (lento por natureza); produção não medida.
   A janela mostra o andamento, então não fica muda.
8. **G, limite em Locais:** duas pessoas da Administração salvando ao mesmo tempo, vale a última (sem conferência de versão). Baixo risco.

**Correções (30/10/2026):** (1) desfazer em dia publicado marca "alterada depois de publicada", sobe a versão e avisa a Administração;
(2) a cópia das vagas grava com a versão do Livro que a conferência leu (se alguém mexeu no meio, 409 e nada é gravado no dia); (3) o
desfazer que deu certo diz "Desfiz a cópia de N dias"; (4) durante a gravação, "Gravando o primeiro dia…" / "N de M dias já copiados";
(5) "Este e os próximos 3 sábados/domingos"; (6) no celular a janela tem 16 px dos dois lados; (7) as regras do Livro são lidas uma vez
por cópia e reaproveitadas de um Livro para o outro; (8) o limite do tempo disponível manda o valor lido ao abrir e recebe 409 com a frase
se outra pessoa salvou antes. Testes: escala-copiar-de-outro-dia (51), escala-copiar-vagas-do-livro (27), escala-tempo-disponivel (66).
Vistos na tela com a API de teste a 375 px: (3), (4), (5) e (6). Não visto na tela: a janela do tempo disponível recebendo o 409.

## 14. Tirar show do dia, refazer os Livros do dia e motivo opcional (30/10/2026, local, sem migração, nada enviado)
Pedido da usuária depois do sábado 31/10 na Acquamotion (o OPENING e o BOAS VINDAS normais precisavam sair; entraram "Mergulhadores de Halloween").
- **"Tirar este show do dia"** (`POST /escalas/dia/tirar-show`, desfazer em `/escalas/dia/tirar-show/desfazer`): botão no bloco de show da visão
  "Por atividade" e item no menu do bloco na grade por pessoa. Cancela o Livro do Dia pelo caminho do cancelamento de sempre
  (`tirarLivroDoDia` em `routes/daily-book.ts`), **motivo opcional**, Administração e Supervisão do local (Direção lê, Elenco não vê).
  Desfazer: faixa logo depois **e** a lista "Tirado deste dia" (com "Voltar ao dia"), que fica enquanto o show estiver fora. Devolver o show
  restaura o Livro como estava (rascunho ou publicado, com o retrato de antes) e só vale para show tirado por este caminho — não abre o
  "reabrir" geral (que segue só da Administração, com motivo). Dia publicado: marca "alterada depois de publicada" e avisa a Administração.
  Livro executado não sai (409 com a frase). Um evento no Registro (`escala.show_tirado_do_dia` / `escala.show_devolvido_ao_dia`).
- **Defeito do Livro cancelado voltar:** o show tirado agora **some da grade** (não vira "Livro do Dia ainda não gerado") e aparece em
  "Tirado deste dia"; gerar o dia e gerar o mês **não recriam** o Livro dele; o resumo do mês não o conta como "Livro que falta". **Decisão
  minha, para a usuária confirmar:** só o show tirado por este botão tem essa proteção (marca `tiradoDoDia` no retrato do Livro, sem
  migração). O cancelamento por apagar o Livro e o descarte do mês **continuam podendo ser gerados de novo**, como sempre foi — se valesse
  para todo Livro cancelado, "descartar o mês e gerar de novo" deixaria de recriar os Livros.
- **Refazer os Livros deste dia** (menu "Mais" da Escala; prévia em `GET /escalas/dia/refazer`): mostra quais Livros em rascunho serão
  refeitos, quantas trocas feitas à mão se perdem e quais ficam como estão (publicado, executado, show de outra pessoa responsável), motivo
  opcional, e refaz um por vez pela **mesma rota** do Livro do Dia (`POST /daily-book/:id/regenerate`); se um falhar, diz qual e por quê.
  Dia publicado: a janela avisa que depois é preciso republicar.
- **Motivo nunca obrigatório:** a cópia "começar do zero" agora aceita motivo vazio (Registro: "Sem motivo informado"). **Ainda obrigatório na
  Escala (não mudei, a usuária decide):** (a) "Saiu ou não vem a partir de…" (3 letras, API e `SaiuDialog`); (b) descartar os rascunhos do mês
  (API `escalas/mes/descartar` e `GerarMesDialog`); (c) chamar na folga e passar de uma regra de escala exigem motivo escrito (a regra
  "folga vence a escala" do AGENTS.md pede isso de propósito). Fora da Escala (não olhei a fundo): reabrir Livro do Dia, operações, solicitações.
- **Testes:** `escala-tirar-show-do-dia.test.ts` (55): perfis e frases de recusa, sem motivo, gerar o dia não recria, cancelamento comum ainda
  regera, resumo do mês, desfazer, dia publicado (versão, aviso, Livro publicado restaurado), executado, prévia e refazer. `escala-copiar-de-outro-dia`
  ajustado (zero sem motivo agora copia).
- **Visto na tela:** modo amostra (`?amostra=1&tirado=1`) nos 4 perfis a 1360 e 375 px (Direção e Elenco sem botões); empresa de teste com a conta
  `teste.admin`, a 375 px: janela de refazer (prévia, "Refazendo 1 de 1…", "1 Livro refeito"), tirar sem motivo, faixa Desfazer, lista "Tirado
  deste dia", "Voltar ao dia"; `teste.direcao` sem botões nem "Mais". **Não visto:** Supervisão de verdade com Livro de show de outra pessoa
  responsável; produção; o Elenco recebendo o aviso depois da republicação.
