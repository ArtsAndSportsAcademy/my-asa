# Plano mestre da Escala — fechar e entregar às Supervisões (31/10/2026)

Este é o **único plano vivo**. Tudo o que já aconteceu (andamento de cada pacote, conferências, commits, contratos da API) está em
[`docs/plano-mestre-escala-historico.md`](plano-mestre-escala-historico.md); as seções citadas abaixo ("histórico, seção 10") são as de lá.
Os planos antigos (`plano-de-construcao-escala-mais-facil.md`, `plano-proximos-passos-escala-2026-10-26.md`) também são só histórico.

Regra de uso: o que mudar de estado muda **aqui primeiro**. Código só com o "pode começar" da usuária; envio ao GitHub só com o "pode enviar".

## 0. Onde estamos (31/10/2026)
- **No ar (produção):** tudo até `da985e4`, com as migrações da 0000 à **0089**. Inclui a equipe por local (pacote O), que ainda está **vazia**
  em produção: até alguém preencher, a Escala segue como antes.
- **Pronto, conferido e NÃO promovido:**
  - **H (copiar de outro dia)** e **G (tempo disponível, migração 0090)**. Ordem: backup, migração 0090, API, site.
  - **Tirar este show do dia, Refazer os Livros do dia, motivo opcional na cópia** (`6d51be8`): só locais, nada enviado, sem migração. Falta a conferência (item 3a).
  - **Correções da conferência (`97a4c4d`, 31/10/2026):** as decisões 32 e 33 viraram regra no código. A Supervisão do local tira o show mesmo com pessoa responsável, e a responsável recebe o aviso no sino (quem tirou, o show, o dia e o motivo, se houver; um por acontecimento). Gerar Livro de show tirado é recusado no "gerar o dia" e na rota manual (409 com a frase "Este show foi tirado deste dia. Use 'Voltar ao dia' na Escala."); só "descartar o mês" limpa a marca. O "Refazer os Livros deste dia" grava o motivo no Registro de cada Livro e um evento da Escala por acontecimento (`POST /escalas/dia/refazer/registrar`).
  - Equipe do local: o rodapé diz por que o Salvar está desligado, e a janela diz o que tocar (`3b35c72`, `0bc8cf2`).
- **Próxima migração livre: 0091.** (O `_journal.json` termina na 0090, a do tempo disponível, já no banco de teste.) Ao criar uma, escreva o
  rollback em `lib/db/drizzle/rollback/` e registre no `meta/_journal.json`.
- **Ordem para promover o que está pronto:** backup → migração 0090 → API → site.

## 1. Decisões que não se reabrem

**Regras gerais**
1. **No show = folga.** Nada a construir.
2. **Folga vence a escala.** Só entra na folga quem foi chamado de propósito, com motivo escrito.
3. **Supervisão vê tudo.** Quem mexe no Livro de um show: Administração, Supervisão do local, responsável. Direção só lê; Elenco não vê estas telas.
4. **Motivo nunca é obrigatório** nas ações novas. Continuam obrigatórios (a usuária decide se muda): "Saiu ou não vem a partir de…", descartar rascunhos do mês, chamar na folga e passar de uma regra de escala.
5. **Fora do plano:** Yeti em dupla, aceitar/recusar mudança (só avisa), tipo "No show", tela "Pausas", dia 23 como estrutura própria.
6. **Tipos já existentes em produção** são renomeados depois, pela janela "Tipos de atividade".
7. **"Conferido" saiu do app inteiro**; a Escala é o centro da tela e abre por atividade.

**Chamadas, rodízio, almoço, prioridade**
8. **Chamadas:** várias por show, tudo configurável (nome, horário fixo ou "X min antes", duração, ocupa tempo ou só informativa, aviso opcional; no show por sessão, no bloco da Programação e na atividade só de hoje).
9. **Rodízio:** dia gerado em rascunho pesa só para os dias **depois** dele; rascunho de dia passado não publicado não conta.
10. **Almoço:** janela sem nomes e sem choque.
11. **Prioridade:** atividade específica ganha do bloco geral, **cortando só o trecho que cruza**. Duas específicas no mesmo horário: **choque só como aviso**, nunca bloqueia salvar nem publicar. Bloco de **grupo** fica fora da regra.
12. **Resumo "quem faz":** 80% = "Elenco todo"; por área ≥ 80% da área; show grande (> 12 posições) = "Elenco do show: N pessoas · ver Livro do Dia"; mínimo de 3 pessoas para resumir; mais de 3 de fora volta a listar nomes. Na impressão há a opção "Escrever o nome de todo mundo".

**Equipe por local** (histórico, seção 10)
13. A equipe **mora dentro da Programação de cada local**, por temporada, com dia da semana e horário opcional ("segunda, Snowland até 13:00"). "Duplicar molde" leva a equipe junto.
14. Blocos gerais ("todo mundo", "a área", janela de almoço) pegam **a equipe do local naquele dia e horário**. Bloco de grupo e de pessoas nomeadas **não filtram**.
15. **Shows pegam o elenco do Livro de onde for**, desde que a pessoa esteja livre no horário; se tiver atividade no seu local, conta como indisponível e entra a reserva (com a frase do porquê). **Hotéis não têm equipe.**
16. A regra é **por pessoa**: quem tem marca na temporada mas não naquele dia sai dos blocos gerais ("sem local hoje"). Quem não tem marca nenhuma segue como antes. **Quem não tem marca não é barrado no Livro do Dia** por estar num bloco "todo mundo" de outro local.
17. **Imprevisto do dia** ("trazer para cá hoje" / "mandar para outro local hoje"): só naquela data, "a partir de" e "até" opcionais, motivo opcional, Registro, aviso à Supervisão do outro local (Administração se não houver). Mesma pessoa em dois locais no mesmo horário: só avisa.
18. **Tempo de ida entre locais é configurável** em Locais, pela Administração.
19. **Nada muda escondido:** em rascunho o bloco geral se recalcula, mas o Livro só muda com "Refazer este dia" ou "Trazer as novidades"; em dia publicado nada muda até republicar, e a Administração é avisada.
20. Primeira vez: o app **sugere** a equipe pelas Escalas feitas; a usuária confere e confirma. Quem mexe: Administração em tudo; Supervisão no **seu** local.

**Copiar de outro dia** (histórico, seção 7, itens 15–24, e seção 11)
21. H1 copia a Escala; H2 copia as vagas dos Livros do Dia (só em Livro que já existe). Administração e Supervisão do local têm as mesmas permissões; publicar é só da Administração.
22. **Juntar** é o padrão (não mexe no que já está); "começar do zero" pede motivo (agora opcional) e é restaurável. Destino já publicado: permitido, marca "alterada depois de publicada", avisa, Elenco segue vendo a versão antiga.
23. Origem de outro dia da semana: permitido (casa por nome e horário). Versão da origem: a publicada, quando houver. **Só dias do mesmo local.** Vários dias de destino de uma vez.
24. Respeita a equipe por local (quem é de outro local, folga ou local fechado fica de fora, com o motivo). Desfazer na faixa logo depois e enquanto ninguém mexeu. **Um aviso por cópia; um evento no Registro por dia copiado.**

**Tempo disponível** (histórico, seção 12)
25. Buraco entre duas atividades da mesma pessoa, a partir do limite do local (padrão 30 min). Antes da primeira e depois da última não conta; almoço-janela, ida entre locais e chamada que ocupa tempo contam como ocupado.
26. **Correção de 30/10: o intervalo antes e depois de uma atividade em hotel não conta** (o pacote 3b abaixo).
27. Buraco ≥ 3 h vai para a linha recolhida "Dia dividido". Lista principal: os 5 maiores + "ver todos". Só Administração e Supervisão veem (a Supervisão vê outras áreas, com o nome da área); **Direção e Elenco não veem**. Configurável em Cadastros → Locais (só a Administração). Não vai para sino, impressão nem grade.

**Tirar show do dia** (histórico, seção 14)
28. "Tirar este show do dia" cancela o Livro pelo caminho de sempre, com motivo opcional; é desfazível ("Voltar ao dia"); show executado não sai; gerar o dia ou o mês **não recria** o Livro do show tirado por este botão. Dia publicado: marca "alterada depois de publicada". A proteção contra recriar está na decisão 33.

**Decididas em 30–31/10 para a Escala nova**
29. **Escala do DIA abre por atividade**; a visão **Por pessoa** é só do dia.
30. **A Semana é por show** (sem semana por pessoa por enquanto) e **o equilíbrio é recomendação, não trava**: só avisa.
31. A **recomendação de shows** é igual para todos do local; "conta para o equilíbrio" é uma marca de cada show (desligada nos de elenco inteiro, como a Patinação).

**Decididas em 31/10 (tirar show do dia)**
32. A **Supervisão do local pode tirar um show do dia mesmo quando o show tem pessoa responsável**; o responsável recebe um **aviso no sino** com quem tirou, o show, o dia e o motivo (se houver).
33. **Show tirado do dia não é recriado em lugar nenhum** (Escala, tela do Livro do Dia, gerar manual): só volta pelo "Voltar ao dia". **A única exceção é "descartar o mês e gerar de novo"**, que limpa essas marcas.

## 2. As telas da Escala
Desenho de referência do dia: `docs/desenhos/escala-simples.html`.

### 2.1 Escala do DIA
**Por atividade (a que abre):**
- **Topo limpo:** o local grande, o dia, a situação (rascunho, publicada, alterada) e **uma ação principal**: *Publicar* (Administração) ou *Enviar minha parte* (Supervisão).
- Uma **linha recolhida** "Não trabalham · Atenção" (quem está de folga ou em outro local; avisos do dia). Toque abre.
- **Lista por atividade, sem botões nas linhas:** uma faixa com a cor do tipo, o nome da atividade, quem faz. Um **pontinho** na atividade que tem problema (choque, vaga vazia, tempo).
- **Tocar na atividade abre um painel com as ações:** Ajustar, Mudar horário, Editar neste dia, Tirar do dia, **Tirar este show do dia** (quando é show), chamadas. No show, o painel mostra **personagem → pessoa**.

**Por pessoa:** a grade atual, tipo Excel (uma coluna por pessoa, horas na vertical), mais limpa. **No celular, cartões.**

### 2.2 SEMANA
- **Por show e atividades programadas:** uma tabela por show — personagens nas linhas, segunda a domingo nas colunas, quem faz em cada casa; "—" quando não há show no dia; elenco inteiro recolhido.
- **Embaixo, "shows de cada pessoa na semana":** ordenados, com a **média**, **destaque de quem está acima e de quem está abaixo**, **filtro por área**; tocar na pessoa mostra os shows dela.
- Sem semana por pessoa por enquanto.

### 2.3 CONFIGURAÇÃO (tela própria)
- **Programação** e **Equipe do local** (saem da Escala do dia e vêm para cá).
- **Regras do local:**
  - limite de shows por dia (já existe);
  - **recomendação de shows por dia e por semana**, igual para todos do local, só avisa;
  - **"conta para o equilíbrio"** em cada show, desligado nos de elenco inteiro (como a Patinação).

### 2.4 MÊS
Relatório. **Só depois de um mês real de uso.**

## 3. Fila de construção
Cada item é **um prompt numa sessão nova**, **conferido na sessão principal antes de começar o próximo**.

| # | O quê | Migração | Observação |
|---|---|---|---|
| a | **Conferir o commit `6d51be8`:** Tirar este show do dia, Refazer os Livros do dia, motivo opcional na cópia | — | só conferir; falta ver Supervisão de verdade com Livro de show de outra pessoa e o Elenco recebendo o aviso depois de republicar |
| b | **Correção do tempo disponível:** intervalo antes/depois de atividade em hotel não conta (decisão 26) | — | **Feito em 31/10:** `locations.type = "hotel"` chega pelo `escala-dia.ts` e tira o intervalo do aviso e do Dia dividido; casos novos em `escala-tempo-disponivel.test.ts` |
| c | **Escala do dia nova** (seção 2.1) | — | por atividade com painel de ações; por pessoa mais limpa; celular em cartões |
| d | **Configuração** (seção 2.3): Programação e Equipe saem do dia; Regras do local com a recomendação e o "conta para o equilíbrio" | provável (a recomendação e a marca por show precisam de lugar no banco: **0091**) | pergunta aberta ao construir: onde guardar a marca "conta para o equilíbrio" |
| e | **Semana por show** com os totais por pessoa (seção 2.2) | — | depende de (d) para a média e o destaque |
| f | **Equilíbrio:** sugestão de troca ao mexer à mão e a partir da semana ("Gi 19, Isa 6: no Teatro de quinta dá para trocar") | — | usa a recomendação e o "conta para o equilíbrio"; só sugere |
| g | **Rodízio e sorteio nas atividades da Programação** (ex.: ir ao hotel; 5S Camarim só N pessoas entre quem está livre) e **"sortear de novo"** no Livro do Dia | provável | desenhar antes |
| h | **Menos cliques (J)**, só as partes que ainda incomodarem: cadastro de várias pessoas, ligar vários personagens ao show, repetir horários nas sessões, bloco em vários horários | — | perguntar quais partes incomodam |
| i | **Relatório do mês** (seção 2.4) | ? | só depois de um mês real |

## 4. Fora da fila / esperando
- **Trocar "folga" e "férias" por "No show" e "Recessos"** no app inteiro: **sessão própria** (decisão de 27/10). A regra "folga vence a escala" continua; só muda o nome.
- **Pessoa em duas áreas** (Amanda e Antônio): conversar com a usuária. A equipe por local já existe.
- **Renomear "Escala do dia" para "Atividade do dia"** no resto do app (Livro do Dia, Solicitações, Registro, avisos): a usuária decide.
- **Observar:** "troquei no Livro e a Escala não atualizou" — não reproduzido em 30/10.
- **"Uma escala só"** (visão "Todos os locais"), **I. Formações no Livro do Dia** (criar, renomear, arquivar): ficam depois da fila; desenhar antes.
- **Para decidir depois:** "saída 13:30" na Minha escala vem do fim da janela do almoço, que não é a saída real; com a Atenção do dia aberta, a grade a 375 px começa a ~400 px do topo; almoço com horário dividido aparece nos dois locais (só avisa).
- **Não visto ainda:** equipe preenchida de verdade em produção; toque em aparelho de verdade e PWA; tempo para gerar um dia em produção com a equipe ligada.

## 5. Configurações que a usuária faz no app (sem código)
1. **Miguel** na equipe dos dois locais, com horário na segunda; as folgas dele ficam em Folgas.
2. **5S Camarim** como "todo mundo" na Programação: a regra de prioridade tira sozinha quem tem show no horário.
3. **Hotéis sem equipe:** os shows ficam na Programação do hotel e o elenco no Livro.
4. **Preencher a equipe** de Snowland e da Acqua (Programação → Equipe do local → "Sugerir pelas Escalas feitas") e conferir uma quinta-feira real: Miguel só em Snowland, almoço de Snowland sem a Acqua, grade sem colunas de gente da outra equipe.

## 6. Como se trabalha
- **Construir em sessão nova** (Sonnet), um item da fila por vez; ao terminar, a sessão diz o item e o intervalo de commits.
- **Conferir na sessão principal:** ler o diff atrás de defeito de regra, rodar os testes que tocam o que mudou, olhar a conta real só lendo, ver a tela nos quatro perfis a 375 e 1360 px; relatar do mais grave ao menos grave; corrigir só com o "corrija" da usuária.
- **Envio ao GitHub só com o "pode enviar".** Nunca merge na `main`.
- **Produção é de quem constrói o app:** backup, migração, API, site — nessa ordem. O assistente aplica migração só no banco de teste.
- Só commitar os arquivos da própria sessão, por caminho; no máximo duas sessões ao mesmo tempo, em arquivos diferentes; testes um arquivo por vez (o banco de teste tem 15 conexões); dados de exemplo com nome de gente só em `import.meta.env.DEV`.
- Comandos e contas de teste: `AGENTS.md` e `docs/prompt-continuar-escala-2026-10-27.md` (seção 4); sem servidor, `?amostra=1` com `sessionStorage["myasa-review-role"]` (`adm`/`sup`/`dir`/`mem`).
