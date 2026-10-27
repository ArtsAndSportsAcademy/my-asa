# Desenho: chamadas na Escala (pacote F) — para aprovar antes de qualquer código

Estado: **desenho, nada construído.** Parte das decisões da usuária de 26/10/2026 (plano mestre, seção 7, item 2). O que está em **PERGUNTA** precisa de resposta dela; o resto é consequência do que já foi decidido.

## 1. O que é uma chamada, em uma frase
Um horário **antes de um show ou atividade** em que as pessoas daquela atividade precisam estar prontas ("Aquecimento 13:00", "Call do show 13:45", depois o show às 14:00). Um show pode ter **várias**.

## 2. O que já existe hoje (e o que falta)
- Cada **sessão** de um show tem **um** horário de chamada (`sessions.call_time`). Ele aparece na tela do show ("chamada 09:50") e no Livro do Dia.
- **A Escala não conhece chamada.** Por isso ela não aparece na grade, na Minha escala, no Meu Dia nem na impressão, e não entra em choque de horário.
- Só uma chamada por sessão, sem nome, sem duração, sem aviso.

## 3. O que uma chamada tem (tudo configurável)
| Campo | Como a pessoa configura | Exemplo |
|---|---|---|
| **Nome** | texto livre, com sugestões (Chamada, Aquecimento, Call do show) | "Aquecimento" |
| **Horário** | **fixo** (13:00) **ou** "X minutos antes" do início da atividade | "15 min antes" |
| **Duração** | minutos (padrão 15) | 15 |
| **Ocupa tempo?** | **Sim** = a pessoa está ocupada e gera choque se tiver outra coisa no mesmo horário. **Não** = só informa ("às 13:45 esteja pronto") e nunca gera choque | Sim |
| **Avisar?** | liga/desliga o aviso a quem vai | Sim |
| **Quem vai** | **não se configura**: são as pessoas que estão no **Livro do Dia** daquele show (ou na atividade) | — |

"X minutos antes" acompanha o horário: se o show muda de hora, a chamada vai junto. Horário fixo não acompanha.

## 4. Onde se configura (três lugares, o mesmo editor)
1. **No show, por sessão** (tela Shows): lista "Chamadas desta sessão", com + Chamada. É onde vive o padrão do show. A chamada de hoje (`call_time`) vira a primeira chamada, chamada "Chamada", sem perder nada.
2. **No bloco da Programação** (janela "Novo bloco"/painel do bloco): opção "Tem chamada" e o mesmo mini-editor. Para atividades que não são show (aula, ensaio).
3. **Na "Atividade só deste dia"**: opção "Tem chamada" e o mesmo mini-editor. Vale só para aquele dia.

Todo editor é uma janela com rodapé Cancelar / Salvar, vale a 375 px e fecha com Esc. Quem pode editar: **Administração, responsável do show e Supervisão do local** (como o resto da Escala); **Direção só lê**; **Elenco** só vê as suas. Toda mudança entra no Registro.

## 5. Como aparece
- **Escala, "Por atividade":** uma linha fina **antes** do show: `13:45 · Chamada do show · 18 pessoas` (com "ver nomes"). Chamada informativa fica em cor mais clara; a que ocupa tempo tem o mesmo peso de uma atividade.
- **Escala, "Por pessoa":** um pequeno marcador na régua do horário da pessoa, no horário da chamada; se ocupa tempo, é um bloco curto.
- **Minha escala e Meu Dia (Elenco):** a chamada aparece como linha própria antes do show: `13:45 · Chamada do show`.
- **Impressão:** uma linha por chamada ("13:45 Chamada do show — Elenco do show: 18 pessoas · ver Livro do Dia").
- **Livro do Dia:** mostra as chamadas do show/sessão no cabeçalho (hoje mostra uma só).
- **Resumo e "Atenção do dia":** chamada que ocupa tempo e bate com outra atividade da pessoa entra em "Mesma pessoa em dois lugares", como qualquer choque (só avisa, não bloqueia).

## 6. Regras que valem (já decididas ou consequência)
1. **Quem vai = quem está no Livro do Dia.** Se alguém é trocado no Livro, a chamada acompanha a troca.
2. **Folga vence:** quem está de folga não recebe a chamada (mesma regra do resto).
3. **A chamada do próprio show não conflita com o show:** ela termina quando o show começa. O editor impede uma chamada que passe do início do show.
4. **Prioridade:** a chamada de um show entra como atividade **específica** (mesma regra de 26/10: específica ganha do bloco geral; corta só o trecho que cruza).
5. **Choque só avisa**, nunca bloqueia salvar nem publicar.
6. **Depois de publicado:** mudar uma chamada é mudança da escala publicada: marca "alterada depois de publicada" e pede republicação, como qualquer ajuste.
7. **Remoção é lógica** (arquiva), restaurável.

## 7. Dados (migração 0086, só no banco de teste; produção é de quem constrói o app)
- Tabela nova `escala_chamadas` (nome, modo `fixo|antes`, hora fixa, minutos antes, duração, ocupa tempo, avisar, ordem, ativo) ligada a **uma** dona: uma **sessão** do show **ou** um **bloco da Programação**.
- Chamada de **atividade só deste dia**: guardada junto da entrada manual do dia (mesma tabela, ligada à Escala do dia).
- Cópia de `sessions.call_time` para a primeira chamada de cada sessão (sem apagar a coluna antiga). Com rollback.
- A Escala monta as chamadas **na leitura**, como já monta o resto (`services/escala-dia.ts`): a chamada vira um bloco do dia, com a lista de pessoas da dona.

## 7b. F1 — o que foi construído (27/10/2026, local, nada enviado)
- **Migração 0086** (só no banco de teste; rollback em `lib/db/drizzle/rollback/`): tabela `escala_chamadas`. As 9 chamadas antigas do banco de teste (`sessions.call_time`) viraram a primeira chamada de cada sessão, **"Chamada", hora fixa, SÓ INFORMA** (não ocupa tempo, para nada passar a gerar choque de repente).
- **Rotas:** `GET/POST /escalas/chamadas`, `PATCH/DELETE /escalas/chamadas/:id` (tirar não apaga; `PATCH {active:true}` restaura) e `POST /escalas/chamadas/copiar`. Quem cria e mexe: Administração, responsável do show e Supervisão do local; Direção só lê; Elenco não. Conferência de versão ao salvar (409 com frase). Tudo no Registro. No máximo 8 chamadas por atividade.
- **A Escala do dia devolve `chamadas`** (lista à parte, lida ao vivo): nome, janela (início e fim), "ocupa tempo", "avisar", a atividade a que levam e as pessoas dela (no show, as do Livro do Dia; folga vence).
- **Copiar para as outras sessões:** hora fixa mantém a distância do início da sessão (13:00 numa sessão das 14:00 vira 16:00 na das 17:00); "X minutos antes" vai igual; não duplica (sessão que já tem chamada é pulada).
- **Ajuste de propósito:** na F1 as chamadas vêm numa **lista à parte** (`dia.chamadas`) e **não** entram ainda em `dia.blocos`. Motivo: o choque, a prioridade e o aviso de convocação só passam a contá-las **na F3**, junto com a tela que as mostra. Assim, quando a F1 for promovida, as chamadas antigas (que viram "só informa") **não aparecem nem mudam nada** na Escala de ninguém.
- **Fica para a F2:** a chamada de **atividade só deste dia** (a tabela já tem onde guardá-la, mas a rota e o editor vêm na F2).

## 7c. F2 — o que foi construído (27/10/2026, local, nada enviado)
- **O mesmo editor nos três lugares** (`components/escala/chamadas-editor.tsx`): cada chamada tem nome (com sugestões Chamada, Aquecimento, Call do show), horário (minutos antes ou hora fixa), duração, "ocupa tempo" e "avisar"; mostra a prévia "Das 13:45 às 14:00" e avisa quando a chamada não cabe antes do início. Janela com Cancelar e "Salvar chamadas", fecha com Esc, vale a 375 px (alvos de 44 px, sem rolagem lateral). Quem só lê (Direção) vê a lista sem "Tirar" nem "+ Chamada".
- **Tela do show:** na janela da sessão, no lugar do antigo "Horário de chamada separado", entra "Chamadas" com o resumo e o botão "Configurar chamadas"; a linha da sessão lista "Aquecimento 13:00–13:30 · Call do show 13:45–14:00"; dentro da janela, "Copiar para as outras sessões do show".
- **Programação:** o painel do bloco ganhou a linha "Chamadas" com "Configurar chamadas" (ou "Ver chamadas" para quem só lê); a janela "Novo bloco" ganhou "Tem chamada?" (as chamadas vão para cada bloco criado, um por dia da semana).
- **Atividade só deste dia:** a janela de criar ganhou "Tem chamada?"; a de corrigir ganhou "Chamadas desta atividade". A chamada fica ligada à Escala do dia; se a Escala já estava publicada, mexer na chamada a marca como "alterada depois de publicada".
- **API:** a chamada de atividade só do dia (Escala + chave do bloco; as entradas "irmãs" da mesma atividade contam como a mesma dona); a lista de sessões e a de Programação devolvem as chamadas junto.
- **Ainda não faz efeito na Escala:** as chamadas só aparecem na Escala, na Minha escala, no Meu Dia, na impressão, no choque e no aviso na **F3**.

## 7d. F3 — o que foi construído (27/10/2026, local, nada enviado)
- **A chamada é uma linha do dia.** A Escala do dia passa a trazer cada chamada como bloco (`origem: "chamada"`), com rótulo "Aquecimento · SHOW", a janela dela e as pessoas da atividade a que pertence. Entra **antes** da prioridade: a que **ocupa tempo** é atividade específica e corta só o trecho que cruza de um bloco geral; a que **só informa** não toma ninguém de bloco nenhum e não entra na conta do choque.
- **Quem vai segue a atividade, no fim de tudo:** trocar alguém no Livro, tirar alguém do bloco, folga e horário só de uma pessoa levam a chamada junto. Chamada de atividade sem ninguém não aparece. `dia.chamadas` continua existindo, agora montada a partir desses blocos.
- **Aviso:** a mensagem de quem recebe a escala publicada ganha "Chamadas: Aquecimento 13:00 (SHOW); Call do show 13:45 (SHOW)" (só as marcadas para avisar). A chamada não conta como bloco nem vira o "a partir de". Como a chamada é bloco do dia, a republicação já avisa quem teve chamada mudada.
- **Onde se vê:** Escala por atividade (linha âmbar, com "só informa a hora" ou "ocupa o tempo de quem recebe"); por pessoa (bloco curto âmbar; o menu do bloco explica que ela acompanha a atividade e onde mudar); Minha escala e Meu Dia (linha própria antes do show; o check-in e a saudação continuam contando a partir da primeira atividade de verdade); impressão (linha por chamada); Livro do Dia (as chamadas da sessão no cabeçalho, no lugar da hora de chamada antiga).
- **O que não se faz com uma chamada:** ajustar quem vai (segue a atividade), mudar o horário só de uma pessoa (409 com frase), "saiu a partir de" (a chamada sai junto com a atividade).
- **Ao promover:** as chamadas antigas migradas (0086, "só informa") passam a aparecer como linha "Chamada · SHOW" na Escala de cada dia com show.

## 8. Etapas de construção (cada uma com testes e conferência em tela, 4 perfis, 375 e 1360 px)
- **F1 · Dados e leitura:** migração, rotas, a Escala monta as chamadas, choque e prioridade. Sem tela de edição ainda (dá para criar por API em teste).
- **F2 · Editor:** o mini-editor nos três lugares (show, Programação, atividade de hoje).
- **F3 · Onde se vê e se avisa:** Escala (atividade e pessoa), Minha escala, Meu Dia, impressão, Livro do Dia, aviso.

## 9. RESPOSTAS da usuária (27/10/2026) — desenho aprovado, falta só o "pode começar"
1. **Avisar:** só dentro do aviso de convocação ao publicar. O lembrete X minutos antes fica para depois.
2. **Show com várias sessões:** copiar as chamadas para as outras sessões, com ajuste em cada uma.
3. **Chamada que ocupa tempo e bate com outra atividade:** só aviso, como todo choque.
4. **Nomes:** configuráveis (texto livre); a lista sugere Chamada, Aquecimento e Call do show.

## 9b. Perguntas que existiam (guardadas para o histórico)
1. **"Avisar" é o quê?** (a) a chamada vai **dentro do aviso de convocação** que a pessoa já recebe ao publicar ("Você entra às 13:45 na chamada do show"), ou (b) além disso, um **lembrete** X minutos antes. **Recomendo (a) agora** e o lembrete (b) como passo seguinte, se quiser.
2. **Show com várias sessões** (10:00 e 15:00): ao criar as chamadas numa sessão, **copiar para as outras** sessões do mesmo show? **Recomendo "copiar, e dá para ajustar em cada uma"**.
3. **Chamada que ocupa tempo e bate com outra atividade da mesma pessoa:** só aviso (como todo choque) — confirmo? **Recomendo sim.**
4. **Sugestões de nome** na lista (Chamada, Aquecimento, Call do show, Passagem de som): quais outras vocês usam? **Recomendo começar com Chamada, Aquecimento e Call do show.**

## 10. O que NÃO entra agora
Chamada por pessoa individual (todas as pessoas do Livro recebem a mesma); lembrete por mensagem fora do app; deslocamento entre parques (espera a resposta da Babi, pacote K).
