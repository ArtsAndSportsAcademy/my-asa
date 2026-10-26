# Escala: plano dos próximos passos (26/10/2026, com as decisões da usuária)

> **Atenção:** o plano vivo, com o estado de cada coisa, é `docs/plano-mestre-escala.md`. Este arquivo guarda o detalhe de cada pacote (A a L, M e N).

Juntei: a reprodução das escalas de 23 a 26/10 (`docs/reproducao-escalas-23-a-26-out.md`), as respostas da Babi, o que a usuária viu no dia 22 em produção e as decisões dela de 26/10. Tamanhos: **P** = até meio dia, **M** = 1 a 2 dias, **G** = 3 dias ou mais. Migração só no banco de teste por mim; produção é de quem constrói o app (ordem: migração, API, site).

## Onde estamos
- Etapas 0 a 7 do plano "Escala mais facil" prontas e em produção (migrações até a 0084).
- **Enviado ao GitHub e ainda não promovido:** o Livro do Dia com "Trazer as novidades do Livro do Show", "Conferido" dentro do Livro, "Ver quem faz o quê" no cartão da Escala e vagas editáveis. Sem migração: só API e site.
- Dia 26 reproduzido pela tela: a geração acertou cerca de 65% do papel sozinha.

## Decisões já tomadas (26/10/2026) — não reabrir
1. **"No show" é folga.** Quem está em NO SHOWS no papel não faz mais nada no dia; o app já trata assim ("Fora o dia todo"). Nada a construir.
2. **Chamadas, tudo configurável.** Um show tem **várias** chamadas (ex.: Patinação: Aquecimento 13:00, Call do show 13:45, Show 14:00). Cada uma tem **nome** (configurável), **horário** (fixo ou "X minutos antes"), duração, e se **ocupa tempo** (gera choque) ou é **só informativa**. Vão nela **quem está no Livro do Dia** daquele show. A pessoa pode receber **aviso**. Configura-se no show (por sessão), no bloco da Programação e na "Atividade só deste dia" (a opção "tem chamada").
3. **Rodízio:** consertar. Hoje só avança ao publicar; deve contar também os dias anteriores já gerados (rascunho), inclusive em "Gerar o mês".
4. **Aviso "tempo disponível":** a partir de 30 min, só para a Supervisão e a Administração; **configurável pelo admin em Locais** (minutos e ligar/desligar).
5. **Almoço:** uma linha só, "ALMOÇO 11:00–13:00", sem nomes e sem choque; aviso pequeno, "só para ver", se alguém ficar sem 1 hora livre na janela.
6. **Prioridade:** a Programação manda. Quem tem uma atividade específica (ensaio, aula) **sai automaticamente** do bloco geral do mesmo horário (ex.: do treino de gelo) e fica na atividade específica.
7. **Resumo no lugar da lista longa, na tela "Por atividade" e na impressão:**
   - **Elenco todo:** quando a atividade tem **80% ou mais** das pessoas do dia.
   - **Por área:** treino de gelo → "Patinadores"; aula de dança → "Bailarinos". Se alguém de fora da área participa: "Bailarinos e Fulano". Não mostra quem faltou (a lista de folga já aparece).
   - **Show grande com Livro próprio** (mais de **12 posições**): "Elenco do show: N pessoas · ver Livro do Dia", sem as posições. Ao clicar abre o detalhe; **só o show grande abre o Livro**. Show pequeno (Teatro, Musical, Montanha) continua listando.
8. **Saem do plano:** Yeti em dupla (o acompanhante já se cadastra no show), "aceitar ou recusar" mudança (por ora só avisa), tipo "No show" novo, tela "Pausas" na planilha (só o almoço aparece), e o dia 23 (sexta) como estrutura própria.
9. **Supervisão vê tudo agora.** Entre parques, o choque deve **considerar o deslocamento** (precisa dos tempos entre Snow, Acqua e hotéis).

## Em espera
- **"Onde a pessoa trabalha no dia" (Snow de manhã, Acqua à tarde, hotéis à noite):** a mensagem para a Babi está pronta, mas **ainda não está pronta para enviar** (decisão da usuária). Depende dela: pessoas entre parques, choque com deslocamento e a lista de tempos.
- **Pessoa em duas áreas** (Amanda e Antônio): depende da resposta acima.

## Pacotes, na ordem recomendada
**0. Promover** o que já está enviado (API e depois site, sem migração) e trazer as novidades do Livro no Teatro 11:30 e no Boas Vindas do dia 22.

**A. Defeitos (sem decisão de regra) · M no total**
| # | Defeito | Tam. |
|---|---|---|
| A1 | **Erro do banco vira "sessão vencida" (401) e joga a pessoa para o login** (`middlewares/auth.ts`). Deve responder erro de servidor e a tela não deslogar. O mais sério. | P |
| A2 | A confirmação de publicar não cita os **choques** nem quem está de folga e convocado. | P |
| A3 | Link do Livro com `?livro=<id>` abre a lista, não o Livro. | P |
| A4 | Janela da senha provisória não fecha com Esc. | P |
| A5 | Meu Dia do Elenco mostra só um dos locais quando a pessoa tem dois no mesmo dia. | P–M |
| A6 | Tela do show: lista de personagens não atualiza ao ligar; "Tirar do show" não remove nem avisa (página de outra sessão: combinar antes). | M |
| A7 | Pessoa desligada aparece como "Pessoa" igual em Folgas. | P |
| A8 | Nome de exibição não muda depois de criado. | P |
| A9 | "Deixar sem ninguém" no Livro vira vaga aberta em vez de tirar o personagem. | P |
| A10 | Conferir se "Enviar minha parte" e "Publicar e convocar" respondem ao clique do navegador embutido. | P |

**B. Nomes dos tipos · P.** Renomear na janela "Tipos de atividade" (ou mudar o padrão do sistema): Treinos e aulas · Ensaio e preparação · Shows · Interação e personagem · Produção e apoio · Almoço · Outras.

**C. Resumo na tela e na impressão (decisão 7) · M.** Sem migração. Na impressão (`/imprimir`) e na visão "Por atividade": "Elenco todo" (≥80%), por área (≥80% da área, com "e Fulano"), show grande resumido com "ver Livro do Dia", almoço em uma linha. Cliquei no resumo → detalhe.

**D. Rodízio (decisão 3) · P–M.** Verificar primeiro se o "Gerar o mês" já cuida; contar os dias anteriores gerados.

**E. Bloco flexível e prioridade (decisões 5 e 6) · M–G.** Migração (um indicador "flexível" no bloco). Almoço como janela sem choque; atividade específica ganha do bloco geral.

**F. Chamadas (decisão 2) · G.** Migração (tabela de chamadas por show e sessão; opção "tem chamada" no bloco e na atividade só de hoje). A chamada aparece na Escala antes do show, na Minha escala, com choque ou só informativa e aviso opcional. Antes de começar: desenhar a tela de configuração.

**G. Tempo disponível (decisão 4) · M.** Migração (colunas em Locais). Aviso para Supervisão e Administração a partir de N minutos livres.

**H. Etapa 8: copiar de outro dia · M.** Sem migração. Copia só quem continua disponível e **mostra quem ficou de fora e por quê** (folga, "no show"…), para entender o que faltou (a Hora da Cuca).

**I. Formações no Livro do Dia · M–G.** Hoje não dá para criar uma do zero nem renomear, editar ou arquivar uma guardada. Conferir antes na tela com um show de mapa de palco de verdade.

**J. Menos cliques · M cada.** Cadastro de várias pessoas de uma vez; ligar vários personagens ao show de uma vez; repetir horários nas sessões; bloco da Programação em vários horários.

**K. Entre parques e "onde a pessoa trabalha" · G.** Em espera pela resposta da Babi.

**L. Fase 2 e Fase 3** (semana e equilíbrio de shows; relatório do mês), por último.

## Pedido de 26/10 à noite: Escala menos poluída (pacotes M e N) — só no plano, nada de código ainda
Decisão da dona, depois de ver a Escala de terça em produção: os cartões "Falta conferir" em cima da Escala poluem, obrigam a rolar muito para achar a atividade e não fazem sentido (quem confere é quem está vendo as pessoas na visão por atividade).

**M. Tirar o "Conferido" do app inteiro · M.** Sem migração (as colunas `conferred_*` do Livro ficam, sem uso, como `reserve_ids` ficou). Sai: a lista de cartões dos Livros de cima da Escala, a faixa e o botão "Conferido" dentro do Livro do Dia, o aviso "Livro sem conferir" na janela de publicar, a "conferência guiada", as rotas `POST/DELETE /daily-book/:id/conferir` e o retrato de conferência (`conferenciaDoLivro`, `manterConferenciaDeQuemMexeu`). Fica: "Trazer as novidades do Livro do Show", "vagas sem ninguém" e "Responsável" onde já aparecem. Conferir: texto da tela, testes (`livro-conferido.test.ts` sai ou vira teste de que a rota não existe), Meu Dia e avisos que citam "conferido". Quem pode mexer no Livro segue como hoje (Administração, Supervisão do local e o responsável do show).

**N. A Escala é o centro da tela · M.** (1) A Escala abre **por atividade** (a visão por pessoa continua, escolhida depois); (2) a grade ocupa o espaço e sobe para o topo: letra e linhas maiores, tanto por pessoa quanto por atividade; (3) o que não é a grade (cartões, resumos, faixas) fica recolhido ou em segundo plano. Fazer depois do pacote E (mexe em `escalas.tsx` e `components/escala/*`, os mesmos arquivos), e conferir na tela a 375 e 1360 px com os quatro perfis.

Ordem sugerida: E (em andamento) → M → N, depois F em diante. M e N podem ir juntos, na mesma sessão, para a grade ser redesenhada uma vez só.

## Como cada pacote é feito
Código, teste de API no banco de teste, conferência na tela em 375 e 1360 px com todos os perfis, e só então commit e "pode enviar". Migração em produção é de quem constrói o app.
