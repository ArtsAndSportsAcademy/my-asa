# Ligar as telas à API — inventário e mapa

Onda 3 fechou o backend das quatro correções estruturais. Este documento faz duas coisas:
lista o que as telas prometem e o backend **ainda não tem**, e dá o mapa tela → endpoint para
o Codex conectar.

Ordem de trabalho: o Codex primeiro responde o **inventário** (passo 0). Sem isso o mapa é
chute — ninguém sabe quais rotas do piloto já existem e quais precisam nascer.

---

## Passo 0 — inventário (primeira tarefa do Codex)

Pedir a lista real de rotas existentes, agrupada por módulo, com método e caminho. Para cada
tela do mapa abaixo, marcar: **existe** · **existe parcial** · **não existe**.

Isso é leitura de código, não construção. É o que transforma o resto num plano com prazo.

---

## Buracos que eu já sei que existem

Estes estão em `07-o-que-falta.md` como "nada disso existe" e os Blocos 1–4 não os cobriram.
Nenhum é defeito — são construção que nunca foi feita.

| # | O que falta | Quem depende | Peso |
|---|---|---|---|
| 1 | **Push de notificação** + PWA instalável | metade do valor do app; no iPhone o push só funciona depois de instalado na tela de início | alto |
| 2 | ~~**Busca global**~~ — **desenhada**, ver tela `30 Busca global` | shell, todas as telas | resolvido |
| 3 | **Auto-publicação da escala** no horário configurado quando não há pendência | 15 Escalas | alto |
| 4 | **Alerta de conflito nos dois momentos definidos** — ao montar o show e ao gerar o Livro do Dia. O Bloco 3 entregou detecção e endpoint; falta *chamar* nos dois pontos e mostrar em tela | 13, 14, 15 | alto |
| 5 | **Datas calculadas** — 23 datas fixas no protótipo. "Amanhã", "esta semana", "vence em 3 dias" precisam sair de `hoje` | todas | alto |
| 6 | **Assistente ASA** respondendo dentro do escopo do perfil | 27 | médio |
| 7 | **Sessão que expira** e login validado no servidor | 01 | alto |
| 8 | ~~Estados de **carregamento** e de **erro**~~ — **desenhados**, ver tela `29 Estados de carregamento, erro e vazio` | todas | resolvido |

E uma coisa que **não pode ir para produção**: o seletor "Ver como", que troca de perfil
livremente. É ferramenta de revisão de desenho. Ninguém escolhe o próprio perfil.

---

## Mapa tela → o que ela precisa da API

Marquei com **[B1–B4]** o que os quatro blocos já entregaram — essas partes são ligar, não construir.

### 17 · Meu Dia
Dia da pessoa + 3 linhas do Mural. Quatro recortes por perfil (MEM próprio · SUP área ·
ADM próprio + governança · DIR organização em leitura).
Precisa: próxima atividade da pessoa, estado do check-in do turno, tarefas e solicitações do
dia, últimos 3 avisos. Para SUP: necessidades a responder, escala a revisar, check-ins em
falta, ocorrências abertas **[B2]**. Para ADM: responsabilidades sem responsável, escalas não
publicadas, necessidades sem resposta.

### 15 · Escalas
Duas abas: Programação (molde) e Escala (o dia). Entra pela Escala.
Precisa: ler e salvar escala por data e local **com `expectedVersion`/If-Match e tratar o 409
com diff** **[B1]**; molde por local e dia da semana com âncora relativa ao show ou hora fixa
e vigência agendável; publicar parte da área (SUP não escreve na área de outro);
"minha escala" por dia e semana (MEM); conflitos da data **[B3]**; auto-publicação (buraco 3).

### 14 · Livro do Dia
Cópia editável do Livro do Show numa data, nasce 80% resolvido, um botão para confirmar.
Precisa: gerar da data **em transação** **[B1]**; ler e salvar com versão + 409 **[B1]**;
resolver personagens pelas filas **[B1+B2]**; lacuna sem solução fica **em branco e
sinalizada**, nunca preenchida em silêncio; biblioteca de formações por quantidade **[B4]**;
conflitos no momento da geração **[B3 + buraco 4]**.

### 13 · Shows (Livro do Show)
Padrão ideal; nunca muda por causa de um dia. Três tipos, interruptor "usa personagens".
Precisa: CRUD de show, cenas e **sessões com início e fim** **[B2]**; agregar personagens por
local **[B2]**; alerta de conflito ao montar **[B3 + buraco 4]**.

### 19 · Check-in e ocorrências
Uma pergunta, um toque, uma vez por turno. Três respostas: pronto · atraso (pede previsão,
fecha com "Cheguei") · falta (pede motivo + texto).
Precisa: registrar e fechar check-in; histórico do mês da pessoa; cobertura da área (SUP);
**ocorrência como entidade com ciclo aberta → em análise → resolvida e motivo obrigatório**
**[B2]**. **Sem fila offline** — sem internet o app manda avisar a supervisão por fora.

### 18 · Folgas
Turmas livres por mês + "repetir a configuração do mês anterior". Pedidos de folga e troca.
Precisa: CRUD de turma por mês, copiar mês anterior, pedido/aprovação/negativa — **negar exige
motivo** **[B1]**.

### 20 · Agenda
Precisa: compromissos da pessoa ou da área por mês, somando escala, folga, reunião e ensaio;
proposta do elenco que vira compromisso **só quando o supervisor libera** — o elenco convida,
nunca convoca.

### 04 · Personagens e formações
Precisa: personagens por local com modo e contador **[B2]**; quem faz cada um hoje **[B1+B2]**;
biblioteca de formações **[B4]**.

### 07 Pessoas · 08 Áreas · 06 Locais
Precisa: CRUD com `ativa`/`encerrado` em vez de exclusão; **desligar pessoa, trocar perfil e
reabrir local exigem motivo** **[B1]**; supervisor por área **e por local**
(`AreaLocalSupervisor`) — Bailarinos tem Victor em Snowland e Stephani em Acquamotion.

### 22 · Mural · 23 · Mensagens
Precisa: aviso com destinatários (área/local/todos), confirmação de ciente,
**cancelar aviso publicado exige motivo** **[B1]**; grupos automáticos por área e local mais
grupos soltos. Depende de push (buraco 1) para valer algo.

### 24 · Biblioteca · 25 · Reconhecimentos · 10 · Responsabilidades · 16 · Painel
Precisa: documentos e vídeos com seções/capítulos (leitura embutida, baixar é secundário);
tempo de casa e marcos; responsabilidades e tarefas com responsável e prazo; agregados de
cobertura, check-ins e ocorrências, em leitura para DIR e por escopo para SUP.

### 01 · Entrada · 28 · Perfil
Precisa: login no servidor, primeiro acesso, esqueci a senha, redefinição pela Administração,
sessão que expira; troca de senha e preferências de notificação. **Conta é criada pela
Administração** — sem convite, sem autocadastro, sem aprovação.

---

## Três regras que valem em toda ligação

1. **Permissão é checada no servidor.** Filtrar no front é apresentação. A tabela de níveis
   por tela está em `02-perfis-e-permissoes.md` — total · leitura · escopo · proprio.
2. **Nada de apagar.** `ativa = false` / `encerrado = true`.
3. **Escrita sensível grava em Registro** com quem, quando, o quê, antes, depois e motivo.

## Ordem sugerida de ligação

Meu Dia → Check-in → Escalas → Livro do Dia → Agenda → Mural → o resto. É a ordem em que a
operação encosta no app: se Meu Dia e Check-in funcionarem, o piloto já tem o que medir.
