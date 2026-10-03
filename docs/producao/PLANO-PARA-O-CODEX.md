# Plano para o Codex: o que ficou com o Claude e o que vem depois

Escrito em 02/10/2026. O Claude vai ficar sem uso por alguns dias, e o Codex segue o trabalho a partir daqui.

**Leia antes:**
- `docs/COMPARACAO-DESENHO-APP-2026-10-02.md`: comparação tela a tela com o desenho, decisões da dona do produto e a etapa 1 feita;
- `docs/producao/MENSAGEM-PARA-O-CODEX.md`: lista de arquivos desta rodada.

**Desenho de referência:** `design_handoff_my_asa/telas/*.dc.html` (no repositório: `design_handoff_my_asa/`).

---

## 0. Regras que continuam valendo

- Responda e escreva textos de tela em **português**.
- **Banco de teste:** é o `.env.test` (projeto Oregon `hhnmav…`). **Produção:** é o `.env.piloto` (São Paulo `jzzwka`).
  - Migração em produção **só com autorização explícita** da dona do produto.
  - Nunca commitar `.env.*`.
- **Nada se apaga de verdade no app:** a desativação é lógica.
- **Toda escrita entra no Registro** (`writeHistoryEvent`), na mesma transação.
- Trocar perfil, cancelar aviso e outras decisões sensíveis exigem **motivo**.
- **Não declarar pronto sem:**
  - typecheck da API e da web;
  - teste no banco de teste;
  - percorrer a tela no modo amostra (`?amostra=1`, seletor "Revisar como") nos 4 perfis, no computador e no celular (375px).
- **Toda tabela nova:**
  - `ENABLE ROW LEVEL SECURITY`;
  - `REVOKE ALL … FROM anon, authenticated, PUBLIC`.
  - O `migrate.ts` recusa a migração sem isso.
- **Valor novo de enum:** não use o literal dele na mesma migração. Compare como texto (`scope::text = 'X'`).
- **Rota pública nova:** marque-a em `tests/permission-matrix.test.ts` (função `inventoryRoutes`).
- Use **"elu" ou linguagem neutra** nos textos sobre pessoas ("Boas-vindas", não "Bem-vinda").

---

## 1. Fechar a rodada do Claude (fazer primeiro)

O código está no disco, **sem commit**.

**Suíte completa, rodada pelo Claude em 02/10 com todo o código desta rodada: 41 de 42 passaram.** A única falha é `asa-actions-http` (linha 624: 403 em vez de 200). É a pendência antiga: o teste ainda espera 200, mas a conversa criada depois do papel revogado deve ser recusada. Ajuste o teste para esperar a recusa.

1. Se mexer em algo, rode a suíte de novo no banco de teste:
   ```
   (carregar .env.test no ambiente) MYASA_TEST_RUNNER=1 node artifacts/api-server/tests/run-tests.mjs
   ```
   - O esperado é tudo verde, menos, talvez, `asa-actions-http` (linha ~624, pendência sua: conversa criada depois do papel revogado deve ser recusada).
   - Se outro teste falhar, corrija antes do commit.
2. Os arquivos estão listados em `MENSAGEM-PARA-O-CODEX.md`. Os pontos de atenção:
   - **Migração nova `0053_mural_pessoas`** (com o rollback). Já está aplicada no banco de teste.
   - Em `routes/asa.ts`, as listagens do Mural chamam `canReadAnnouncement` com `select` que podem não trazer `id` e `authorId`. Inclua esses campos, senão um aviso para pessoas escolhidas (`PEOPLE`) não aparece pela ASA para quem o recebeu.
   - Se a ASA publica ou rascunha aviso, a Supervisão agora publica igual à Administração (casa, área, local ou pessoas).
3. Antes do commit:
   - `git status` limpo de `.env.*`, `.tmp*`, `*.log`, `.audit-tmp/`, `tests/.dist/`, `artifacts/brand/`, `output/`;
   - typechecks verdes. Para a API, rode antes `npx tsc -b lib/db/tsconfig.json`, porque os tipos do banco vêm do `dist`.
4. Commit e push em `codex/myasa-novo`. **Não junte na `main`.**

### Publicar em produção (nesta ordem)

1. **Peça à dona do produto a autorização** para aplicar **0052 e 0053** em São Paulo.
   - A produção está na 0051.
   - As duas entram juntas e em ordem. Aplicar só a 0053 faria o migrador pular a 0052 para sempre.
2. Com a autorização, rode o `lib/db/src/migrate.ts` com o `DATABASE_URL` do `.env.piloto`.
   - Confira antes que a URL é a de São Paulo, e depois que o enum `announcement_scope` tem `PEOPLE`.
3. Só então a dona do produto promove na Vercel os dois deploys do commit novo: o site (`my-asa-web`) **e** a API (`my-asa`).
   - A API ainda está numa versão antiga: `PUT /api/users/:id/perfil` dava 404.
4. Confira em produção:
   - rota de perfil devolve 401 sem login;
   - `/api/auth/esqueci-senha` responde 200;
   - o Mural abre.

---

## 2. Decisões da dona do produto (02/10)

1. **Abas do celular:** as do app (Meu Dia / Minha escala / Check-in / Mural / Mais).
2. **Folgas e Solicitações:** um item de menu só, com duas abas. **Feito.**
3. **Supervisão por GRUPO** dentro da área. O local é só onde se trabalha e não define supervisão.
4. **Check-in POR TURNO.** A Administração configura só o **nome e o horário** de cada turno.
   - Exemplo: "Dia" 07:00–18:00 e "Noite" 18:00–22:00.
   - Por agora, os turnos são **iguais para todos os locais**.
5. **Espaços nos Locais** (Palco A…): depois.
6. **Reconhecimentos:** fica dentro do Mural. Não é tela própria.
7. **Avisos:** Supervisão publica igual à Administração (casa, área, local ou **pessoas escolhidas**). **Feito.**

---

## 3. Próximas etapas (em ordem)

Cada etapa termina com a tela comparada de novo com o desenho e com a porcentagem atualizada no relatório.

### Etapa 2: Check-in por turno (desenho `19 Check-in e ocorrências`), ~4 dias

**Banco** (migração 0054): tabela `shifts` com:
- `id`, `organization_id`, `name`, `start_time`, `end_time`, `active`, timestamps;
- RLS;
- os check-ins (`operational_check_ins`) ganham `shift_id` e passam a ser únicos por pessoa + data + turno.

**Regras automáticas** (sem configuração):
- A pessoa só vê o check-in de um turno se tem algo **na escala publicada** dentro dele.
- O bloco da escala pertence ao turno em que **começa**.
- O check-in abre **2 h antes** da primeira atividade da pessoa naquele turno. Antes disso o botão não aparece.
- Depois do início da atividade, o check-in continua aberto, mas fica marcado "atrasado". A tolerância de 15 min já existe (`late_threshold_minutes`).
- Fim do turno:
  - quem não respondeu fica "sem resposta";
  - quem avisou atraso e não tocou em "cheguei" fica "atraso sem chegada confirmada".
- A tela de configuração **avisa se ficou horário sem turno**. Uma atividade nesse buraco conta no turno anterior.
- Mudar a configuração entra no Registro e vale **a partir do dia seguinte**.

**Configuração (Administração):** nome e horário de cada turno, 1 a 3 turnos. Pode morar no Painel ou numa aba "Turnos" do Check-in.

**Tela do Elenco:**
- abas por turno do dia;
- três botões grandes: **Pronta / Atraso** (pede previsão e fecha com "Cheguei") / **Falta** (pede motivo: enfermidade, problema pessoal, transporte, outro + texto);
- "o que o check-in cobre neste turno", com as atividades da escala;
- histórico do mês;
- pontualidade dos últimos 30 dias;
- estado **sem sinal**, com orientação para avisar a supervisão e botão de ligar.

**Tela da Supervisão:**
- lista por pessoa, com estado e ações ("marcar chegada", "abrir substituição");
- números no topo;
- alerta "Fulana não vem hoje → Resolver na Escala";
- números da área em 30 dias.

**Ocorrência:** continua entidade própria (aberta → em análise → resolvida). Já existe.

### Etapa 3: Folgas, mapa do mês (desenho `18 Folgas`), ~3–4 dias

- Planilha com pessoas nas linhas e dias nas colunas, para Administração e Supervisão.
- Ferramentas de "pintar": F folga, R recesso, A atestado, O outro.
- **Turmas A/B/C** (grupos que folgam juntos; não confundir com turno).
- Contador por semana e totais.
- "Repetir a configuração do mês anterior".
- "Publicar mês".
- Abas Mapa do mês / Registros / Regras e grupos.
- Negar pedido exige motivo.
- O backend já tem `folgas/grid`: comece por ele.
- O Elenco continua com "Minhas folgas".

### Etapa 4: Mural e Escalas, ~2–3 dias

**Mural** (desenho `22`):
- contadores no topo;
- selo "aguardando seu ciente";
- data do evento como etiqueta;
- para quem publicou: progresso do ciente ("41 de 58") e "quem falta";
- aniversário como cartão no feed, com contador de "Parabéns";
- reconhecimento continua no Mural.

**Escalas** (desenho `15`):
- barra fixa embaixo: + horário, Folga, Recesso, Registrar troca, Salvar rascunho, Publicar;
- aba "Minha escala";
- atalho para o Livro do Dia;
- no celular: "Do local / Minha escala" e "Precisa de você".

### Etapa 5: Agenda, Pessoas e Áreas com grupos, ~3–4 dias

**Agenda** (desenho `20`):
- visão de **semana em grade** e **Meu mês**;
- "A revisar" passa a se chamar "Propostas";
- o Elenco só convida, nunca convoca (já é assim).

**Pessoas** (desenho `07`):
- **tabela** no computador (Nome / Área / Grupo / Perfil / Desde / Estado) e cartões no celular;
- filtros Todas / Ativas / Afastadas / Sem grupo;
- abas Pessoas / Acessos / Histórico / Registros.

**Áreas** (desenho `08`):
- **área → grupos**, cada grupo com um supervisor (decisão 3);
- migrar a supervisão de "área + local" para "grupo";
- abas Áreas / Grupos / Registros;
- confira se a tabela `operational_groups` serve antes de criar outra;
- depois disso, "um grupo" pode virar destino de aviso no Mural.

### Etapa 6: Mensagens e Biblioteca, ~4–5 dias

**Mensagens** (desenho `23`):
- grupos automáticos por área e por local;
- "Meus grupos", filtros e contador de não lidas;
- mensagem fixada, responder citando, silenciar, ver integrantes.
- Ficam para depois: áudio, reações, anexos e "virar tarefa".

**Biblioteca** (desenho `24`):
- **leitor embutido por seções**, com índice à esquerda e anterior/próxima;
- filtros "Esperando você" e "Mudou esta semana";
- progresso de confirmação e histórico de versões;
- "Pedir um material" pode virar uma Solicitação "Outro assunto";
- a pasta de coreografias e vídeos fica de fora.

### Etapa 7: Painel e Locais, ~3 dias

**Painel** (desenho `16`), organizado em 4 perguntas:
1. Hoje tem gente para tudo? (shows do dia e a situação de cada um)
2. O que cumprimos em 7, 30 e 90 dias, com tendência.
3. As pessoas aguentam? (carga e folgas)
4. O que está travado.

**Locais** (desenho `06`):
- dias da semana de funcionamento, período e "abre hoje";
- shows programados no cartão;
- abas Semana e Registros;
- espaços ficam para depois.

### Pequenos que sobraram da etapa 1

- Pílula de contexto no cabeçalho ("área Patinadores").
- Rodapé padrão: versão, Ajuda, "Privacidade e dados", Falar com a Administração.
- 3 telas de boas-vindas no primeiro acesso (desenho `01`).
- Meu Dia:
  - "Documento novo" em "Do seu lado";
  - no celular, o cartão "Agora / em 18 min" no lugar da linha do tempo.
- Busca global (desenho `30`): resultados agrupados por tipo, com linha de contexto.
- Não conferido com login real:
  - sino com avisos;
  - primeiro acesso;
  - conta desativada;
  - "Esqueci minha senha" ponta a ponta. Esse aviso chega à Administração e leva a **Pessoas e acessos**; a senha provisória se gera lá.

---

## 4. Como conferir cada tela

1. `.claude/launch.json` tem `web-admin` (porta 3000) e `api-server` (porta 3001, usa `.env.test`).
2. Modo amostra: `http://localhost:3000/<rota>?amostra=1`, com o seletor "Revisar como" no rodapé do menu.
3. Desenho: abra o `.dc.html` correspondente em `design_handoff_my_asa/telas/` num servidor estático.
4. Atualize a tabela de porcentagens em `docs/COMPARACAO-DESENHO-APP-2026-10-02.md` ao fim de cada etapa.
