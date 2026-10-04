# Comparação tela a tela: desenho × app

Data: 02/10/2026.

**Desenho comparado:** `design_handoff_my_asa/telas/*.dc.html` e o zip "Estrutura My ASA — navegação e shell atualizado".

**App comparado:** branch `codex/myasa-novo`, rodando em localhost no modo amostra (`?amostra=1`), nos 4 perfis.

**Viewport:** desktop 1440×900. Também olhei o mobile do desenho.

**Como ler a porcentagem:** é o quanto a tela do app se parece com a do desenho. Conta estrutura (abas, blocos, ordem), conteúdo (o que a tela mostra) e ações (botões que existem). Não é pixel a pixel. A meta pedida é 90%.

**Legenda das recomendações:**
- **TRAZER**: falta no app e vale construir.
- **FICA COMO ESTÁ**: o app fez diferente e a diferença é aceitável ou melhor. O desenho cede.
- **FORA**: está no desenho, mas não entra agora. Fica para depois ou foi descartado.
- **DECIDIR**: precisa de uma escolha sua antes de construir.
- **Tamanho**: P (até meio dia), M (1–2 dias), G (3+ dias, mexe em banco ou API).

---

## Resumo

| Tela | Desenho | App | Parecido | Situação |
|---|---|---|---|---|
| 14 | Livro do Dia | /livro-do-dia | **~90%** | ✅ dentro da meta |
| 28 | Perfil e configurações | /perfil | **~90%** | ✅ dentro da meta |
| 04 | Personagens e formações | Shows › Personagens | **~85%** | ✅ quase |
| 17 | Meu Dia | /meu-dia | **~80%** | 🟡 ajustes pequenos |
| 10 | Responsabilidades e tarefas | /responsabilidades | **~80%** | 🟡 ajustes pequenos |
| 13 | Shows | /shows | **~85%** | 🟡 cartões e favorito conferidos; data com dados reais pendente |
| 15 | Escalas | /escalas | **~75%** | 🟡 faltam abas e barra de ações |
| 22 | Avisos e Mural | /mural | **~80%** | 🟡 destinos/cancelamento conferidos; faltam progresso do ciente e contadores |
| 07 | Pessoas | /pessoas | **~55%** | 🟠 layout diferente |
| 20 | Agenda | /agenda | **~50%** | 🟠 faltam abas |
| 23 | Mensagens | /mensagens | **~50%** | 🟠 faltam grupos automáticos |
| 08 | Áreas | /areas | **~50%** | 🟠 modelo diferente (DECIDIR) |
| 30 | Busca global | barra lateral | **~50%** | 🟠 parcial |
| Shell | Menu, cabeçalho e abas do celular | todas | **~80%** | 🟡 menu/abas conferidos; faltam contexto e acabamentos |
| 19 | Check-in e ocorrências | /check-in | **~85%** | 🟡 turnos e estados implementados na etapa 2; homologação real pendente |
| 24 | Biblioteca | /biblioteca | **~40%** | 🔴 falta o leitor |
| 01 | Entrada (login etc.) | /login | **~75%** | 🟡 login/recuperação conferidos; primeiro acesso visual pendente |
| 16 | Painel | /painel | **~65%** | 🟡 reorganizado nas quatro perguntas; tendências históricas ainda ficam para acompanhamento |
| 06 | Locais | /locais | **~65%** | 🟡 funcionamento, abre hoje, shows programados e abas Semana/Registros |
| 18 | Folgas | /folgas | **~25%** | 🔴 o desenho é uma planilha do mês |
| 25 | Reconhecimentos | — | **0%** | DECIDIR |
| 27 | Assistente ASA (página) | botão flutuante | — | área do Codex |
| 02 | Mobile do elenco | — | ~55% | ver Shell |
| 03 | Formulários simplificados | vários | ~70% | 🟡 |
| 29 | Carregando, erro e vazio | todas | ~75% | 🟡 guia, não é tela |
| 00 | Auditoria | — | — | documento antigo, não é tela |

**Média geral da avaliação inicial: cerca de 60%.** As quatro linhas atualizadas pela conferência do Codex estão detalhadas abaixo; não houve uma nova avaliação de todas as telas.

### Revisão visual da etapa 1 pelo Codex — 02/10

Estimativas de aproximação, não percentuais de testes aprovados. Conferência em amostra nos quatro perfis, desktop 1440×900 e celular 375×812. Shows, Mural, Shell e Entrada avançaram nos pontos acima; Tarefas permanece em ~80%, pois a amostra não contém cartões preenchidos para validar. Os detalhes das seções seguintes preservam o diagnóstico inicial do Claude; a seção "Etapa 1" e o [registro de validação do Codex](producao/VALIDACAO-ETAPA-1-CODEX-2026-10-02.md) distinguem o que mudou das pendências.

Não foram validadas visualmente sessões reais de primeiro acesso, conta desativada, notificações e Solicitações populadas. A meta de 90% não é declarada atingida para essas telas. Etapas 2–7 continuam pendentes.

Hoje só 3 telas batem a meta de 90%. O bom é que o **funcionamento** (banco, regras, permissões, Registro) está muito à frente do desenho. O que falta é quase sempre **apresentação e ações que a API já sabe fazer**. Há exceções: Folgas, Check-in por turno, Locais com espaços e Áreas com grupos pedem mudança de banco ou API.

---

## Estrutura geral (shell): vale para todas as telas

### Menu lateral

O desenho tem 4 grupos:

- **Porta de entrada**: Meu Dia.
- **O dia**: Agenda, Escalas, Shows, Livro do Dia, Check-in e ocorrências, Responsabilidades e tarefas, Folgas e solicitações.
- **Gestão e fundação**: Painel, Locais, Pessoas e acessos, Áreas, Reconhecimentos.
- **Comunicação**: Avisos e Mural, Mensagens, Biblioteca.

O app tem 5 grupos: Operação / Pessoas / Comunicação / Gestão / Registro.

| Diferença | Recomendação |
|---|---|
| Nomes e ordem dos grupos | **TRAZER** (P). Usar os 4 grupos do desenho. É só texto e ordem em `shell-foundation.tsx`. |
| "Folgas" e "Solicitações" separadas no app; uma só no desenho ("Folgas e solicitações") | **DECIDIR**. Minha sugestão: um item de menu só, com duas abas dentro. |
| "Registro" é um item de menu no app; não existe no desenho | **FICA COMO ESTÁ**. O Registro é exigência de vocês (tudo fica registrado). Coloco no grupo Gestão. |
| O elenco vê nomes próprios no desenho: Minha agenda, Minha escala, Meus shows, Minhas tarefas, Minhas folgas, Meu grupo, Conversas | **TRAZER** (P). Trocar os rótulos quando o perfil for Elenco. |
| "Pessoas e acessos" (desenho) × "Pessoas" (app) | **TRAZER** (P). |

### Cabeçalho de cada tela

O desenho tem:

- data por extenso embaixo do título;
- pílula com o contexto ("área Patinadores");
- sino com número de notificações;
- botão da ASA no cabeçalho.

O app tem só o título. A ASA flutua no canto.

| Diferença | Recomendação |
|---|---|
| Data e pílula de contexto | **TRAZER** (P). |
| Sino com contador e central de notificações (desenho 01) | **TRAZER** (M). As notificações já existem na API. Falta a central na tela. |
| Botão da ASA no cabeçalho em vez de flutuante | **FORA**, por agora. A ASA é do Codex. No celular o desenho também usa flutuante. |

### Abas do celular

O desenho não é coerente entre os arquivos:

| Arquivo do desenho | Abas |
|---|---|
| Estrutura | Meu Dia / Escalas / Equipe / Avisos / Mais |
| 17 | Meu Dia / Escala / Mural / Conversas / Mais |
| 19 | … / Mensagens / Mais |
| 02 | Hoje / Escala / Presença / Mais |
| **App hoje** | **Meu Dia / Minha escala / Check-in / Mural / Mais** |

- **DECIDIR** qual vale. Minha sugestão: manter a do app. Check-in é a ação diária do elenco e merece aba. Mensagens fica dentro de "Mais".
- **TRAZER** (M): a página "Mais" organizada pelos mesmos grupos do menu, como no desenho 02.

---

## Telas, uma a uma

### 17 · Meu Dia: ~80%

**Igual:**
- saudação e resumo do dia;
- próxima atividade;
- pendências ("Precisa de você");
- 3 linhas do Mural;
- linha do tempo do dia;
- versão por perfil (MEM, SUP, ADM, DIR).

**Diferente:**

| Item | Recomendação |
|---|---|
| Cartão "ASA sugere" | **FORA** por agora. É da ASA (Codex). Deixar o lugar reservado. |
| "Do seu lado" sem "Documento novo" (biblioteca esperando ciente) | **TRAZER** (P). A API da biblioteca já tem confirmação de leitura. |
| Mobile do desenho é mais enxuto: sem linha do tempo, com cartão "Agora / em 18 min" | **TRAZER** (M). No celular, trocar a linha do tempo pelo cartão "Agora". |
| Cabeçalho (data, sino) | ver Shell. |

### 15 · Escalas: ~75%

**Igual:**
- abas Escala e Programação;
- grade por pessoa e horário;
- blocos coloridos por tipo;
- folga na grade;
- pedidos aprovados viram bloco;
- publicação.

**Diferente:**

| Item | Recomendação |
|---|---|
| Abas "Livros do dia", "Publicação" e "Minha escala" | **TRAZER** "Minha escala" como aba (P). O elenco já tem a visão própria; é organizar. "Livros do dia" pode ser um atalho para a tela 14 (P). "Publicação" deve virar painel lateral, não aba. |
| Barra inferior: + horário, Folga, Recesso, Registrar troca, Salvar rascunho, Publicar | **TRAZER** (M). As ações existem espalhadas. O desenho junta tudo numa barra fixa. |
| Etiqueta do local nas células (SNW / ACQ) | **TRAZER** (P). O dado já vem no bloco. |
| Painel da ASA escrevendo na grade | **FORA**. Área do Codex. |
| Mobile: "Do local / Minha escala", "Precisa de você", "Escala de bolso" (guardada para ver sem sinal) | **TRAZER** as duas primeiras (M). "Escala de bolso" (offline) fica **FORA** por agora (G). |

### 14 · Livro do Dia: ~90% ✅

Mesmas abas, mesma faixa de cenas, mesma explicação, números, sessões e personagens do dia.

Só detalhes de espaçamento. **FICA COMO ESTÁ.**

### 13 · Shows: ~80%

**Igual:**
- lista de shows com tipo (completo, só personagens, simples);
- favorito;
- abrir o Livro do Show (cenas, blocos, mapa de palco);
- aba Personagens.

**Diferente:**

| Item | Recomendação |
|---|---|
| Cartão do show sem descrição, nº de cenas, responsável e data de atualização | **TRAZER** (P). Os dados existem. |
| Fita "ATUALIZADO" e aviso "X shows atualizados desde a sua última visita" | **TRAZER** (M). Precisa guardar a "última visita" por pessoa. |
| Ordenar ("Ordem") | **TRAZER** (P). |
| Painel da ASA | **FORA** (Codex). |

### 04 · Personagens e formações: ~85% ✅

**Igual:**
- lista por local com filtro;
- Titular ou Rodízio;
- "Quem entra hoje" com a razão;
- fila com contagem;
- shows e sessões onde o personagem aparece.

**Diferente:** só acabamento visual. **FICA COMO ESTÁ.**

### 10 · Responsabilidades e tarefas: ~80%

**Igual:**
- abas Tarefas e Responsabilidades;
- "Preparar lote", com a tarefa entrando só quando o lote é confirmado;
- filtros por situação.

**Diferente:**

| Item | Recomendação |
|---|---|
| Filtros: o desenho tem Hoje / Em aberto / Vencidas / Feitas / **Minhas**; o app tem Hoje / Abertas / Atrasadas / Concluídas / Todas | **TRAZER** (P): os nomes do desenho e o filtro "Minhas". |
| Tarefas agrupadas, com "como fecha" visível | Não deu para conferir com dados no modo amostra (a tela pede a API). Revisar com dado real. |
| Formulários "Nova responsabilidade" (7 campos) e "Tarefa avulsa" (4 campos) do desenho 03 | Conferir campo a campo com dado real (P). |

### 19 · Check-in e ocorrências: ~85% 🟡 (etapa 2, 03/10)

**Atualização da etapa 2:** check-in por turno global (1–3 configuráveis),
convocação pela escala publicada, três ações do elenco, confirmação de chegada
após atraso, janela e fechamento, histórico mensal, indicadores de 30 dias,
supervisão por pessoa/área+local, aviso de falta e ocorrência separada. A
Direção vê totais, sem nomes ou motivos. Amostras dos quatro perfis foram
comparadas com o desenho em desktop e 375 px. Diferenças visuais restantes:
o desenho usa uma composição mais editorial para o histórico e a faixa de
recomendação da ASA; esta última não foi criada sem regra de produto aprovada.
O percentual é de aproximação visual/funcional, **não** comprova homologação
com login real nem implantação da migração 0054 em produção.

**Diagnóstico original (02/10, antes da etapa 2):**

O desenho pensa o check-in **por turno**:

- Manhã e Noite, cada um com janela de abertura;
- três botões grandes na tela (Pronta / Atraso / Falta);
- "o que você cobre neste turno";
- histórico do mês;
- pontualidade dos últimos 30 dias.

Para a **Supervisão**, o desenho tem:

- lista por pessoa com o estado de cada uma e ações (marcar chegada, abrir substituição);
- números no topo;
- alerta "Carol não vem hoje → Resolver na Escala";
- números da área em 30 dias.

O app tem o check-in do dia (pronto, atraso, falta, "Não vou") e a lista de ocorrências.

| Item | Recomendação |
|---|---|
| Visão da Supervisão por pessoa, com ações e alerta | **TRAZER** (M). É o que a supervisão mais usa. A API já tem os check-ins do dia. |
| Histórico do mês e pontualidade de 30 dias | **TRAZER** (M). |
| "O que você cobre neste turno" | **TRAZER** (P). Vem da escala do dia. |
| Check-in **por turno** (Manhã e Noite) | **DECIDIR** (G). Hoje é um check-in por dia. Por turno muda o banco. Na Snowland existe mais de um turno no mesmo dia por pessoa? |
| Estado "sem sinal" com botão de ligar para a supervisão | **TRAZER** (P). |

### 18 · Folgas: ~25% 🔴

O desenho é uma **planilha do mês**: pessoas nas linhas, dias nas colunas. Tem:

- ferramentas de "pintar" (F folga, R recesso, A atestado, O outro);
- turmas A, B e C;
- contador por semana e totais;
- botão "Publicar mês";
- abas Mapa do mês / Registros / Regras e grupos.

O app mostra pedidos de folga e a lista.

| Item | Recomendação |
|---|---|
| Mapa do mês (planilha) para ADM e SUP | **TRAZER** (G). O backend já tem `folgas/grid`. O trabalho é a tela. Para quem monta folgas é a diferença mais sentida. |
| Turmas A/B/C e "repetir o mês anterior" | **TRAZER** junto com o mapa (M). |
| Para o elenco: "Minhas folgas" (o mês dela e os pedidos) | **FICA COMO ESTÁ**, com o título já ajustado ("suas folgas · Seu mês"). |
| Juntar com Solicitações | ver **DECIDIR** no Shell. |

### 20 · Agenda: ~50%

**Igual:**
- faixa da semana;
- "Minha jornada" juntando escala, folga, Livro do Dia e convites;
- "Marcar compromisso";
- "A revisar".

**Diferente:**

| Item | Recomendação |
|---|---|
| Abas Minha semana / Meu mês / Espaços / Propostas / Categorias | **TRAZER** "Meu mês" (M) e "Propostas" (P; já existe como "A revisar", é renomear). "Espaços" depende de Locais ter espaços (ver 06). "Categorias" é configuração; pode ir para a Gestão (**FORA** da Agenda). |
| Visão de semana em grade, com a faixa da jornada | **TRAZER** (M). Hoje o app mostra um dia por vez. |
| Elenco "só convida, nunca convoca" | Já respeitado na API. ✅ |

### 22 · Avisos e Mural: ~75%

**Igual:**
- feed de avisos;
- aviso com destinatários;
- confirmar ciente;
- aniversário;
- filtros.

**Diferente:**

| Item | Recomendação |
|---|---|
| Contadores no topo e selo "aguardando seu ciente" | **TRAZER** (P). |
| Progresso do ciente ("41 de 58") e "quem falta" (para quem publicou) | **TRAZER** (M). Os cientes já são gravados. |
| Data do evento como etiqueta no aviso | **TRAZER** (P). |
| "Me lembra disso" | **FORA** por agora (M; precisa de lembrete agendado). |
| "Cancelar aviso", com motivo obrigatório | **TRAZER** (P). A regra está no desenho e é importante. |
| Aniversário como cartão dentro do feed, com contador de "Parabéns" | **TRAZER** (M). |
| Escrever aviso com 3 tipos | **TRAZER** (P). Conferir com o perfil Supervisão. |

### 23 · Mensagens: ~50%

O app tem conversas diretas e grupos simples. O desenho tem muito mais:

| Item | Recomendação |
|---|---|
| Grupos automáticos da casa (por área e por local) | **TRAZER** (M). É a regra principal do desenho ("Grupos automáticos por área e local"). |
| "Meus grupos", filtros, contador de não lidas | **TRAZER** (P). |
| Mensagem fixada, responder citando, silenciar, ver integrantes | **TRAZER** (M). |
| Reações, áudio, anexos | **FORA** por agora (G). |
| "Virar tarefa" a partir da mensagem | **FORA** por agora. Depende de Responsabilidades e da ASA. |

### 24 · Biblioteca: ~40% 🔴

O desenho é um **leitor em duas colunas**:

- pastas à esquerda;
- filtros "Esperando você" e "Mudou esta semana";
- leitura dentro do app, por seções, com anterior e próxima;
- progresso de quem confirmou;
- histórico de versões;
- "Pedir um material";
- "Pergunte em vez de procurar" (a ASA citando a página).

O app lista documentos com tipo e ciente.

| Item | Recomendação |
|---|---|
| Leitor embutido por seções | **TRAZER** (G). É o coração do desenho 24. |
| Filtros "Esperando você" e "Mudou esta semana" | **TRAZER** (P). |
| Progresso de confirmação e histórico de versões | **TRAZER** (M). |
| "Pedir um material" | **TRAZER** (P). Pode virar uma Solicitação do tipo "Outro assunto". |
| ASA citando páginas | **FORA** (Codex; a migração 0052 ainda não está em produção). |
| Pasta de coreografias e vídeos | **FORA**, já decidido antes. |

### 07 · Pessoas: ~55%

O desenho é uma **tabela**:

- colunas Nome / Área / Grupo / Perfil / Desde / Estado;
- abas Pessoas / Acessos / Histórico / Registros;
- filtros Todas / Ativas / Afastadas / Sem grupo;
- faixa da ASA com atenção.

O app usa cartões, com perfil, área, login e "sem perfil".

| Item | Recomendação |
|---|---|
| Tabela em vez de cartões (no computador) | **TRAZER** (M). No celular continuam cartões. |
| Filtros Ativas / Afastadas / Sem grupo | **TRAZER** (P). |
| Aba "Acessos" (perfis e logins) | **TRAZER** (P). O que já existe (perfil, senha provisória) muda de lugar. |
| Abas Histórico e Registros | **TRAZER** (P). Filtro do Registro já existente. |
| Coluna "Grupo" | depende do **DECIDIR** de Áreas. |

### 08 · Áreas: ~50%

O desenho tem **área → grupos**, cada grupo com um supervisor. O app modela a supervisão por **área + local**.

| Item | Recomendação |
|---|---|
| Grupos dentro da área | **DECIDIR** (G). Na prática a supervisão é por grupo (como "grupo B" da Julia) ou por local? A escolha muda banco, permissões e Folgas (turmas). |
| Abas Áreas / Grupos / Registros | **TRAZER** depois da decisão. |

### 06 · Locais: ~35% 🔴

O desenho tem por local:

- dias da semana em que funciona;
- período de funcionamento;
- "abre hoje";
- shows programados;
- **espaços** (Palco A etc.);
- abas Locais / Semana / Registros.

O app tem o cadastro simples do local.

| Item | Recomendação |
|---|---|
| Dias de funcionamento, período e "abre hoje" | **TRAZER** (M). Pede colunas novas. |
| Shows programados no cartão | **TRAZER** (P). |
| Espaços (Palco A etc.) | **DECIDIR** (G). Só vale se a Agenda for reservar espaços. |
| Abas Semana e Registros | **TRAZER** (P/M). |

### 16 · Painel: ~35% 🔴

O desenho responde 4 perguntas:

1. Hoje tem gente para tudo? (lista de shows com a situação de cada um)
2. O que cumprimos em 7, 30 e 90 dias, com tendência.
3. As pessoas aguentam? (carga e folgas)
4. O que está travado, com a ASA lendo os números.

O app tem indicadores gerais.

| Item | Recomendação |
|---|---|
| Reorganizar nas 4 perguntas | **TRAZER** (M). Os dados de 1 e 2 já existem (escala, check-in, livro). |
| "As pessoas aguentam?" | **TRAZER** (M). Sai de folgas e horas na escala. |
| "ASA lê" | **FORA** (Codex). |

### 01 · Entrada, notificações e estados: ~40% 🔴

**Login:**

| Item | Recomendação |
|---|---|
| Topo escuro e tela dividida no computador | **TRAZER** (P). É visual. |
| "mostrar" na senha | **TRAZER** (P). |
| Tela "Esqueci minha senha" com "Avisar a Barbara" (a Administração redefine) | **TRAZER** (M). Hoje há só a dica em texto. |
| Primeiro acesso só com "nova" e "repetir", e as regras se marcando ao digitar | **TRAZER** (P). |
| Tela "Conta desativada" | **TRAZER** (P). |

**Notificações:**

| Item | Recomendação |
|---|---|
| Central de notificações (sino, "Precisa de você" com ações ali mesmo) | **TRAZER** (M). |
| Preferências por tipo de notificação (escala e ciente travados) | Já existe no Perfil ✅ |

**Boas-vindas:**

| Item | Recomendação |
|---|---|
| 3 telas de boas-vindas | **TRAZER** (P). |
| Passo de instalar o app | já existe ✅ |
| Rodapé padrão (versão, ajuda, privacidade, contato) | **TRAZER** (P). |

### 28 · Perfil e configurações: ~90% ✅

Foi feito a partir do desenho. Tem:

- foto (colocar, trocar, tirar);
- nome de uso, telefone e e-mail;
- mudar senha;
- "Quem vê o que sobre você" (telefone, e-mail, nascimento);
- "Como o My ASA te avisa" com silêncio noturno;
- sessões abertas e "encerrar as outras";
- sair.

Diferença: no celular o desenho entra pelo avatar, com uma lista de seções. Conferir depois (P). **FICA COMO ESTÁ.**

### 25 · Reconhecimentos: 0%

No desenho, reconhecer acontece no Mural. Esta tela é o **painel de quem lidera**:

- histórico;
- quem é reconhecido e por quem;
- "quem trabalha há meses e nunca ouviu nada".

O app não tem esta tela.

**DECIDIR:** construir (M) ou deixar **FORA** na primeira entrega. Minha sugestão: **FORA** agora, e trazer quando o Mural tiver o reconhecimento.

### 27 · Assistente ASA (página inteira): área do Codex

O desenho tem uma página com o que a ASA faz (Responde, Resolve, Lembra, Redige, Traduz, Ensaia), a memória visível e o que ela aprendeu. No app a ASA é o botão flutuante. **Não comparo em detalhe.** É do Codex, e sigo sem mexer nos arquivos dele.

### 30 · Busca global: ~50%

O desenho tem uma caixa só, com:

- resultados agrupados por tipo, com uma linha de contexto;
- datas como resultado ("sexta" → o dia);
- a ASA por último, ou primeiro quando é uma pergunta.

O app tem a busca na barra lateral, parcial. **TRAZER** (M) o agrupamento por tipo e a linha de contexto. A parte da ASA é do Codex.

### 02 · Mobile do elenco: ~55%

| Item | Recomendação |
|---|---|
| "Mudou desde ontem" no Hoje | **TRAZER** (M). |
| Página "Mais" organizada por grupos | **TRAZER** (M). Ver Shell. |
| Escala guardada para ver sem sinal | **FORA** por agora (G). |
| Botão de voltar nas telas internas | conferir tela a tela (P). |

### 03 · Formulários simplificados: ~70%

O app já usa formulários curtos, de uma coluna, com o erro dentro do próprio diálogo (corrigido na auditoria).

Falta conferir com dado real os de Responsabilidade e Tarefa avulsa (desenho: O quê / Para quem / Quando / Fecha como).

### 29 · Carregando, erro e vazio: ~75% (guia)

**O app já segue:**
- o erro diz o que fazer e traz "Tentar de novo";
- o vazio explica;
- o erro fica no painel onde aconteceu.

**Falta:**

| Item | Recomendação |
|---|---|
| O esqueleto ter a forma da tela (barras no lugar das linhas da escala) | Em algumas telas ainda aparece só "carregando". **TRAZER** (P por tela). |
| Vazio "filtro sem resultado" com "limpar filtro" | Revisar tela a tela (P). |
| Ao salvar com erro, dizer se o que foi digitado se perdeu | Revisar tela a tela (P). |

### 00 · Auditoria

É um documento antigo do desenho, de setembro. Diz que "não existe aplicativo", o que **não vale mais**: hoje há banco, login, permissões e Registro. Não é tela. Ignorar.

---

## O que FICA (o app é igual ou melhor e o desenho cede)

1. Livro do Dia, Perfil e Personagens, como estão.
2. "Registro" como item próprio, no grupo Gestão.
3. Check-in como aba do celular do elenco (se você aprovar).
4. Folgas do elenco ("Minhas folgas") como estão.
5. ASA flutuante, até o Codex fechar a parte dele.
6. Tudo que é regra (motivo obrigatório, desativar em vez de apagar, Registro) já é mais forte no app do que no desenho.

## O que NÃO FICA agora (desenho → depois)

1. Tudo que é da ASA dentro das telas: "ASA sugere", ASA escrevendo na grade, ASA lendo o painel, ASA citando a biblioteca. Isso é do **Codex**.
2. Escala guardada para ver sem sinal (offline).
3. Mensagens com áudio, reações e anexos; "virar tarefa".
4. "Me lembra disso" no Mural.
5. Pasta de coreografias e vídeos (já decidido).
6. Reconhecimentos (sugestão).

## Decisões tomadas (02/10/2026)

1. **Abas do celular:** ficam as do app (Meu Dia / Minha escala / Check-in / Mural / Mais).
2. **Folgas + Solicitações:** um item só no menu, com duas abas.
3. **Áreas:** a supervisão é **por grupo** dentro da área. O local é só o lugar onde se trabalha.
4. **Check-in:** é **por turno**. A Administração configura os turnos (ver proposta abaixo).
5. **Espaços nos Locais:** ver depois.
6. **Reconhecimentos:** fica dentro do Mural. Não é tela própria.

### Turnos: o que a Administração configura

A Administração configura **só o nome e o horário** de cada turno. Por agora, os turnos valem **iguais para todos os locais**. Exemplo:

| Turno | Horário |
|---|---|
| Dia | 07:00–18:00 |
| Noite | 18:00–22:00 |

Todo o resto é automático:

| Item | Como funciona |
|---|---|
| Abertura do check-in | 2 h antes da primeira atividade da pessoa naquele turno |
| Tolerância de atraso | 15 min (já existe) |
| Lembrete | já existe nas regras da casa |
| Motivos de falta | enfermidade, problema pessoal, transporte, outro (texto livre) |

**Regras automáticas:**
- A pessoa só vê o check-in de um turno se tem algo na escala dentro dele.
- O bloco da escala pertence ao turno em que **começa**.
- A tela da configuração avisa se ficou algum horário sem turno. Uma atividade nesse buraco conta no turno anterior.
- Antes da janela abrir, o botão não aparece. Depois do início, o check-in continua aberto, mas sai marcado "atrasado".
- No fim do turno:
  - quem não respondeu fica "sem resposta";
  - quem avisou atraso e não tocou em "cheguei" fica "atraso sem chegada confirmada".
- Mudar a configuração entra no Registro e vale **a partir do dia seguinte**, para não mexer no turno em andamento.

## Etapa 1: acabamentos (andamento em 02/10)

### Feito

| Item | O que mudou | Conferido |
|---|---|---|
| Menu | 4 grupos do desenho (Porta de entrada / O dia / Gestão / Comunicação), na ordem do desenho. Nomes "Pessoas e acessos", "Avisos e Mural", "Check-in e ocorrências". Registro dentro de Gestão. | tela, 4 perfis |
| Nomes do elenco | Minha agenda, Minha escala, Shows, Meus shows, Check-in, Minhas tarefas, Minhas folgas, Meu grupo, Mural, Conversas, Biblioteca (desenho 28). | tela, Elenco |
| Folgas e solicitações | Um item só no menu, com as abas Folgas e Solicitações. Os links antigos para /solicitacoes continuam funcionando. | tela, celular |
| Cabeçalho | Data por extenso embaixo do título. Sino com o número de não lidas, a lista das últimas 20, "marcar todos como lidos" e clique levando à tela certa. No celular, o sino fica na barra de cima. | tela (sem login, com a mensagem "entre na sua conta") |
| Abas do celular | Nomes curtos ("Check-in", "Mural") para caber. | celular, Supervisão |
| Shows | O cartão mostra responsável, descrição curta e data de atualização. O elenco vê Shows no menu, só com os publicados: o servidor esconde os rascunhos dele, menos o show delegado a um capitão. **Corrigido um defeito:** favoritar show nunca adicionava, só tirava. | tela + teste no banco de teste (238 verificações) |
| Responsabilidades | Filtros com os nomes do desenho: Hoje / Em aberto / Vencidas / Feitas / Minhas (para a gestão) / Todas. | typecheck |
| Mural | "Cancelar aviso" com motivo obrigatório, que fica no Registro. O servidor diz em cada aviso quem pode cancelar. **Decisão de 02/10:** a Supervisão publica aviso igual à Administração (toda a casa, qualquer área ou qualquer local). A lista de destinos vem de `GET /communication/destinations`. **Corrigidos dois defeitos:** a Supervisão não conseguia publicar aviso nenhum, e "Uma área" e "Um local" não mandavam qual área ou local. O servidor agora recusa área ou local de fora da organização. O erro aparece dentro da janela, sem apagar o mural. | tela + teste no banco de teste |
| Entrada | Tela dividida no computador e topo escuro no celular. "mostrar" na senha. Tela "Esqueci minha senha" com "Avisar a Administração": sem e-mail, sempre a mesma resposta, no máximo um aviso a cada 30 min por pessoa, e o pedido fica no Registro. Tela "Conta desativada". Mensagens próprias para conta sem perfil e convidado expirado. | tela, computador e celular + teste no banco de teste (41 verificações) |
| Primeiro acesso | Só "Nova senha" e "Repetir a senha", com as 3 regras se marcando enquanto digita. A senha provisória digitada na entrada fica só na memória da aba. Se a página recarregar, ela é pedida de novo. | typecheck |
| Regra da senha | 8 caracteres, com letra e número, no servidor, no primeiro acesso e no Perfil. Antes eram 6 caracteres. | teste no banco de teste |

### Aviso para pessoas escolhidas (pedido de 02/10)

No Mural, além de toda a casa, uma área ou um local, o aviso pode ir para **pessoas escolhidas**: marca quantas quiser (até 300), de qualquer área, com busca por nome ou área. Não há "grupos" fixos.

- Só as pessoas escolhidas e quem publicou leem o aviso e dão ciente. A Administração e a Direção leem tudo, como antes.
- O aviso mostra para quem foi ("para Cris, Barbara e mais 3").
- A lista de quem recebe entra no Registro.
- **Banco:** migração **0053** (tabela `announcement_recipients`, valor `PEOPLE` e a regra de destino atualizada).
  - Aplicada só no banco de teste.
  - **Precisa ser aplicada em produção antes de publicar**, com a sua autorização.
- **Conferido:** tela (Supervisão) e teste no banco de teste (117 verificações no Mural).

### Não se aplica

- **Etiqueta do local nas células da Escala:** a grade do app é sempre de um local só, e "Minha escala" já mostra o local.

### Ficou para depois

- Pílula de contexto ("área Patinadores") no cabeçalho.
- Rodapé padrão (versão, ajuda, privacidade).
- 3 telas de boas-vindas.

## O que precisava da sua DECISÃO (respondido acima)

1. **Abas do celular:** manter as do app (Meu Dia / Minha escala / Check-in / Mural / Mais)? O desenho tem 4 versões diferentes.
2. **Folgas + Solicitações:** juntar num item só com duas abas?
3. **Áreas:** a supervisão é por **grupo** dentro da área (como no desenho) ou por **local** (como no app hoje)?
4. **Check-in por turno:** existe mais de um turno no mesmo dia por pessoa?
5. **Locais com espaços** (Palco A etc.): vale ter, com a Agenda reservando espaço?
6. **Reconhecimentos:** fica fora da primeira entrega?

---

## Ordem sugerida para chegar perto dos 90%

Prioridade para o que o elenco e a supervisão usam todo dia.

| # | Bloco | Telas | Tamanho |
|---|---|---|---|
| 1 | Acabamentos rápidos: rótulos do menu e do elenco, cabeçalho com data, filtros e nomes, etiquetas de local, cartões do Shows, "cancelar aviso", login (mostrar senha, primeiro acesso, conta desativada) | Shell, 01, 10, 13, 15, 22 | ~2 dias |
| 2 | Check-in: visão da Supervisão, histórico, "o que cobre" | 19 | ~2 dias |
| 3 | Folgas: mapa do mês com turmas | 18 | ~3–4 dias |
| 4 | Mural: progresso do ciente e "quem falta"; Escalas: barra de ações e "Minha escala" | 22, 15 | ~2–3 dias |
| 5 | Agenda (semana e mês); Pessoas em tabela com abas | 20, 07 | ~3 dias |
| 6 | Mensagens com grupos automáticos; Biblioteca com leitor | 23, 24 | ~4–5 dias |
| 7 | Painel nas 4 perguntas; Locais com dias e período | 16, 06 | ~3 dias |
| depois das decisões | Áreas com grupos, check-in por turno, espaços | 08, 19, 06 | G |

Com os blocos 1 a 4 feitos, a média sobe de ~60% para ~75–80%. As telas do dia a dia ficam em ~85–90%. Com os blocos 5 a 7, a média passa de ~85%.
