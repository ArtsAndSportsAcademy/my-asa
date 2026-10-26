# Reproduzir as escalas de papel (23 a 26/10) pela tela — relatório

Empresa de teste, local "Snowland papel 26-10", Escala NOVA (worktree escala-mais-facil). Tudo gravado pela tela; nomes do elenco trocados por pessoas de teste (mapa fora do repositório). Passos = cliques/digitações de verdade.

## 1. O que ficou IGUAL ao papel (dia 26, depois de clicar em "Gerar Escala e Livros", sem mexer)
- Todos os blocos, com horário e nome: Aula Edu, Ensaio de Teatro, Ensaio de Bailarinos (2), Treino de gelo, Boas-vindas, Yeti (4 horários), Assistir Teatro, Teatro 11:30 e 15:30, Musical, Guardião, Gravação, Produções, Aquecimento, Show de Patinação, Montanha, Distanciamento, Fisio, Fotos, ADM.
- Quem faz: Aula Edu, Ensaio de Teatro (10), Assistir Teatro, Guardião, Produção (3 + 3), Fotos (6), ADM, Boas-vindas (2), Teatro 11:30 (3), e 8 dos 9 papéis do Musical (Mensageira, Suj, Bor, Astrid, Igno, Chocolato, Mensageiro, Acompanhamento do Yeti).
- Cores por tipo: o "Automático pelo nome" acertou Ensaio, Treino de gelo, Almoço; Aquecimento caiu em Produção/apoio (no papel é Shows).
- Cartões "Livros do dia" (7 cartões, conferência), "Enviar minha parte", confirmação ao publicar e perfis (Supervisão vê tudo, Direção "Somente leitura", Elenco vê "Minha escala" e funciona a 375 px).

## 2. O que ficou DIFERENTE e por quê
1. Almoço: papel "11–12 OU 12–13 conforme as atividades"; o app só sabe um bloco fixo 11–13 para todos → 20 choques de horário.
2. Yeti: o rodízio deu os 4 Yetis do dia a uma pessoa e o do Musical à outra (papel: o Yeti do Musical é a mesma pessoa dos outros e nos blocos de 20 min entram DUAS pessoas). Corrigi na tela (Ajustar bloco do Musical).
3. "Por área" trouxe a Supervisão para o Ensaio de Bailarinos e o Treino de gelo pegou 24 pessoas (produção e os 3 NO SHOWS). O papel diz "exceto quem tem outra atividade".
4. Teatro 15:30 repetiu o elenco das 11:30 (papel: outro elenco). O app tem o cartão separado "Teatro · 15:30", mas o elenco vem do padrão.
5. Show de Patinação e Show Montanha: só tem o que eu cadastrei (1 posição / 0 pessoas). Limite meu, não do app: o Livro grande (≈85 posições, 12 cenas) custa ≈10 passos por posição.
6. Uma pessoa estava de folga por dado antigo do teste, então um bloco de gravação ficou com 1 pessoa.

## 3. O que o app NÃO consegue representar (por ordem do que mais atrapalha amanhã)
1. NO SHOWS: pessoa que trabalha mas não faz show no dia. Folgas só tem Folga, Recesso, Afastamento, Outro, Limpar. Os 3 NO SHOWS entraram em Treino, Almoço, Aquecimento e Fisio.
2. Almoço flexível ("conforme as demais atividades") e "exceto quem tem outra atividade" → choques em massa. Deveria haver "bloco que cede" (não gera choque).
3. Elenco do Musical/Teatro que muda por dia. O Livro do Show repete o titular todo dia; no dia 25 o Livro saiu igual ao do 26 (papel muda ~7 papéis). Custo de ajuste ≈ 25–40 passos por dia só de elenco.
4. Duas pessoas ao mesmo tempo num personagem de rodízio (Yeti: Lucas e Maico).
5. Dia 23 (sexta) tem estrutura própria (Treino Camp, Lugares show, Passagem do show, Descer Yeti, Recesso/No show por pessoa): o molde nem descreve.
6. Área "Produção/Apoio": a empresa de teste só tinha Patinadores e Bailarinos; produção virou "Patinadores".

## 4. Trabalhoso demais (ideias de menos cliques)
- Cadastro de pessoas: 8 passos por pessoa, sem lote; o nome de exibição (primeira palavra) NÃO muda depois — perdi ~110 passos. Ideia: cadastrar várias pessoas de uma vez (planilha) e permitir ajustar o nome de exibição.
- Ligar personagens ao show: 2 passos por personagem, um por vez, a lista se reordena (cliquei em Noel em vez de Mensageiro). Ideia: seleção múltipla e busca.
- Sessões: 4 passos por horário (Yeti 4 horários = 16). Ideia: "repetir horários".
- Bloco do molde: 7 passos; Yeti são 4 blocos quase iguais. "Criar em N dias" ajuda (lote por dia da semana), mas não por horário.
- Ajustar elenco do dia: uma troca = 3 passos; "Aplicar N mudanças" agrupa (bom).

| Etapa | Passos (tela) | Repetição |
|---|---|---|
| Pessoas (21) | ≈170 (+≈110 perdidos) | mesma janela 21× |
| Local + supervisão | 4 + 6 | supervisão só na tela Áreas, 2× |
| 6 shows | 36 | mesma janela 6× |
| 14 personagens | ≈90 | 6 passos cada |
| Ligar personagens + 8 sessões | 30 + 32 | mesma janela |
| Molde de segunda (22 blocos) | ≈190 | Yeti ×4, Teatro ×2 |
| Gerar | 1 clique (64 s) | |
| Ajustes dia 26 (Musical) | ≈8 (+10 Teatro, não feito) | |
| Enviar partes + Publicar | 2 + 2 | |
| Dias 25/24/23: blocos de Livro em lote | ≈32 para 3 dias | |
| Dia 25: gerar | 1 clique | ajustes de elenco ≈40 (estimado) |

## 5. Defeitos de código/tela achados (arquivo quando deu para saber)
- artifacts/api-server/src/middlewares/auth.ts:36-42: qualquer erro de banco vira 401 "Token invalid or expired"; a tela entende como sessão vencida e manda para o login (aconteceu com o banco lento).
- Tela do show (web-admin, página de shows): lista de personagens não atualiza após ligar; "Tirar do show" não removeu nem avisou.
- Desligar pessoa mantém "Pessoa" nas listas de Folgas (desligadas aparecem como "Pessoa" iguais).
- Link do Livro do Dia com ?livro=<id> abre a lista, não o livro.
- Janela da senha provisória não fecha com Esc (crivo 15).
- Confirmar "Publicar" não cita os choques de horário nem pessoas de folga.
- Botões "Enviar minha parte" e "Publicar e convocar" não responderam a clique do navegador embutido (só a clique por script): pode ser limite da ferramenta; vale checar.
- Meu Dia do Elenco mostrou só o outro local quando a pessoa tem dois locais no mesmo dia.
- "Deixar sem ninguém" no Livro vira "vaga sem ninguém" no aviso em vez de tirar o personagem do dia.

## 6. O que NÃO consegui ver/fazer
- Show de Patinação completo e lista do Montanha; folgas dos NO SHOWS (sem tipo); ajustes do Teatro 15:30 e de todo o dia 25; gerar/comparar dias 24 e 23 (tempo); fotos em 1360×900 de todas as telas (usei 1280×840 e 375×812).
- Usei script para clicar em dois botões (Enviar minha parte, Publicar e convocar) e para trocar de login (gravar o token no navegador); gravações em si sempre pela interface.

## 7. Fidelidade do dia 26
Cerca de **65%** do papel ficou fiel (blocos, horários, quem faz) depois de gerar e de corrigir o Musical. Sem a minha limitação do Livro de Patinação/Montanha seria ≈75%. Os 25% a 35% que faltam são: almoço, NO SHOWS, rodízio do Yeti, elenco por dia/sessão e "exceto quem tem outra atividade".

Capturas: `...\scratchpad\capturas\` (10 arquivos). Notas corridas: `...\scratchpad\reproducao-notas.md`.
