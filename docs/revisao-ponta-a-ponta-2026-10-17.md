# Revisão de ponta a ponta com uma empresa fictícia (17/10/2026)

Pedido: montar no banco de **teste** uma empresa inventada, com 3 locais, simular o trabalho real de cada perfil e revisar
lógica, layout e código. Tudo abaixo foi feito no banco de teste; produção não foi tocada.

## 1. A empresa fictícia

**Cia. Horizonte de Espetáculos (fictícia)**, criada pelo mesmo comando de instalação de uma casa nova
(`criarPrimeiraAdministracao`): a Administração entrou com a senha provisória, foi obrigada a trocá-la e montou o resto
**pela API**, como a tela faria.

- 2 operações (Parque Horizonte; Parque das Águas), **3 locais**: Teatro Horizonte, Arena de Gelo, Lagoa Encantada
  (mais 2 "Palco Itinerante" criados só para testar o defeito do item 2.1).
- 4 áreas (Patinação, Dança, Atores e Personagens, Técnica de Palco — esta **sem supervisão**, de propósito).
- 25 pessoas com nomes inventados: 1 Administração (Helena), 1 Direção (Rafael), 3 Supervisões (Camila, Diego, Marina),
  21 Elenco. Cada uma fez o primeiro acesso e trocou a senha. As senhas ficaram só num arquivo fora do repositório.
- 3 shows (Musical com titular e rodízios, Gelo Mágico, Sereias da Lagoa só formação), programação dos 3 locais
  (blocos de todos, por área, por pessoas e de livro), **outubro e novembro gerados** nos 3 locais (109 dias, 0 falhas).
- Dia de hoje no Teatro: áreas prontas, publicado, Elenco confirmou, ajuste depois de publicado, republicado.
- Pedidos de folga, Mural (aviso com ciente, publicação do Elenco), conversa privada e grupo, reunião na Agenda,
  tarefas, documento da Biblioteca com confirmação de leitura.

**O que segurou bem (testado e recusado com frase clara):** senha fraca/igual/atual errada; login errado não revela se
o usuário existe; local duplicado; Elenco sem área; vaga em show de formação; fila repetida; fim antes do início;
Supervisão mexendo em programação de outro local, em área alheia, em pessoa de outra área; Direção publicando;
publicar sem áreas prontas; versão velha (conflito); Elenco confirmando escala em que não está; folga no passado; Elenco
publicando aviso oficial; Administração lendo conversa privada; Direção editando documento; Supervisão publicando para
outra área. **A versão publicada protege o Elenco:** depois do ajuste, a pessoa continua vendo a versão publicada até a
republicação, e o aviso "Sua escala mudou" sai pela fila.

## 2. Erros de lógica e funcionais

### Corrigidos nesta revisão

| # | O que estava errado | Onde | Correção |
|---|---|---|---|
| 1 | Ao abrir o app, **qualquer** falha do `/me` (sem sinal no parque, deploy no ar, erro 500) apagava a sessão e jogava a pessoa no login com a credencial boa. A renovação já tinha essa regra; a abertura não (crivo 9). | `web-admin/src/contexts/AuthContext.tsx` | Só 401/403 encerram; nos outros erros a pessoa entra com o que estava guardado. |
| 2 | Meu Dia da Administração dizia "Nenhum local com escala publicada hoje. **Nada que só você resolve**" com a escala de hoje em rascunho e show em 2h53 — só ela publica. Hoje em rascunho nem aparecia nas pendências (crivo 4). | `api-server/src/services/meu-dia.ts` | Nova pendência "Escala de hoje · Local", conta como "só você resolve" quando as áreas estão prontas; texto e botão "Revisar a escala de hoje". |
| 3 | Meu Dia do Elenco às 12h: "Você entra às **09:00** em Aquecimento" (crivo 13). | `meu-dia.ts` | Depois do primeiro bloco: "Seu dia começou às 09:00 (Aquecimento) e o check-in ainda não foi feito." |
| 4 | A Escala abria **sempre em amanhã**, inclusive para o Elenco no dia do show; os atalhos do Meu Dia ("Republicar a escala de hoje", "Escala de hoje · Lagoa") caíam em amanhã e no último local aberto (crivo 11). | `pages/escalas.tsx`, `meu-dia.ts`, `operational-cycle.tsx` | Elenco abre em hoje; a tela aceita `?data=` e `?local=`; Meu Dia e Painel mandam o dia e o local. Conferido no navegador. |
| 5 | Livro do Dia: o cartão mostrava a **operação** ("Parque Horizonte") no lugar do local e "—" no lugar da hora — o caso 12 do crivo voltou. | `routes/daily-book.ts`, `pages/livro-do-dia.tsx` | Detalhe do Livro passa a trazer `locationName`; cartão e cabeçalho mostram o **local** (conferido no navegador). A hora aparece quando o show tem sessão no Livro do Show; **show sem sessão continua com "—"**, porque a geração não grava na Agenda a hora dos blocos da Programação (e um mesmo Livro pode ter 10:30 e 15:00). Proposta: a geração gravar a primeira hora da Programação e o cartão listar as demais. |
| 6 | "Musical 15h **15:00**": a hora era colada ao nome do bloco mesmo quando o nome já a trazia. | `meu-dia.ts`, `escalas.tsx`, `print-day.tsx` | Só cola a hora se o nome não tiver "15h"/"15:00". |
| 7 | Painel: "falta(s) registrada(s)", "posição(ões)" — o resto do app usa plural de verdade. | `operational-cycle.tsx` | Singular/plural certos. |
| 8 | `operationForLocation` pegava **qualquer** operação ligada ao local (sem ordem, até operação parada); com duas ligações a Escala podia nascer na operação errada ("Show fora do local"). | `services/escala-dia.ts` | Prefere a operação ativa e a ligação mais antiga. |

### Pedem decisão (não mexi)

1. **Local novo com duas operações ativas trava o show (alto).** `POST /locations` liga o local novo a **todas** as
   operações ativas. Com Snowland e Acquamotion ativas (o caso de produção), criar show nesse local responde
   `LOCAL_OPERATION_AMBIGUOUS` — "Ajuste o contexto operacional" — e **não existe tela para isso**. Reproduzido na
   empresa fictícia. Opções: perguntar "de qual operação é este local?" no cadastro só quando houver mais de uma ativa;
   ou ligar só à operação de quem cria. Também não há tela para criar/ativar operação (a 2ª operação nasce em rascunho
   e a ativação pede um checklist que nenhuma tela preenche).
2. **"Pronta" exige todas as áreas da casa em todo local.** A Escala lista as 24 pessoas da casa em cada local e pede
   "pronta" de Atores, Dança e Técnica na Arena de Gelo, onde nenhuma delas tem bloco nem supervisão. Para publicar, a
   Administração precisa marcar áreas que não têm nada a ver com o local; o Meu Dia diz "o resto está com a supervisão",
   o que é falso para área sem supervisão ali. Proposta: contar só áreas com gente escalada ou com supervisão no local;
   área sem supervisão vira item da Administração.
3. **Supervisão e tarefas da equipe.** O AGENTS.md (decisão de 16/10) diz que a Supervisão "vê e cobra" as tarefas da
   própria área; o código e `docs/tarefas-e-responsabilidades.md` exigem a responsabilidade "Aprovação de tarefas". Numa
   casa nova, a Supervisão vê "Você vê só as suas tarefas". Qual vale?
4. **Painel: dois cartões com o mesmo número.** "Hoje tem gente para tudo?" e "O que cumprimos?" mostram os dois
   `coverage.pct`. O segundo devia medir outra coisa (ex.: shows feitos / programados).
5. **Livro do Dia: "Nenhuma sessão deste show cai hoje"** com o Musical programado duas vezes hoje. As sessões do Livro
   do Show e os blocos da Programação são coisas diferentes, mas a frase contradiz a Escala. Trocar a frase ou ler a
   Programação.
6. **Ajuste em lote não é atômico.** `/escalas/dia/ajustes` com várias pessoas aplica uma a uma e para no primeiro erro
   (ex.: a terceira está de folga): as duas primeiras ficam gravadas e a resposta é só o erro. Ou tudo numa transação,
   ou devolver a grade com o que entrou.
7. Pequenos: recusas sem frase (`{"error":"Forbidden"}` ao confirmar escala em que não está, Supervisão de fora na
   Programação); id malformado responde 500 ("Erro ao criar vaga") em vez de 404; erros de validação técnicos que só a
   API vê ("weekday de 0 a 6", "regra livro precisa de showBookId"); "decided_by" do pedido que entra como prioridade
   é a própria pessoa que pediu.

## 3. Layout, composição e espaçamento

Varredura automática a 375 px nas 15 telas (Supervisão): **nenhuma tela transborda na horizontal**. Achados:

| Onde | Problema | Situação |
|---|---|---|
| `pages/meu-dia.tsx` · "Sua próxima atividade" | No celular o título caía para baixo da hora e deixava um vão vazio ao lado da barra roxa. | **Corrigido** (`flex:1 1 160px`). |
| `pages/meu-dia.tsx` · "Hoje, nos locais" | A etiqueta "ESCALA EM RASCUNHO" (143 px, sem quebra) espremia o nome do local em 63 px: 6 linhas para "Arena de Gelo". | **Corrigido**: a linha quebra e a etiqueta desce à direita (nome com 216 px). |
| `pages/meu-dia.tsx` · Mural | Frase de desenho vazando para a pessoa: "Três linhas, sempre. A lista inteira mora no Mural." | **Removida.** |
| `pages/agenda-workspace.tsx` | Número de tela do protótipo no título: "20 · O DIA". | **Corrigido**: "Agenda · o dia". |
| `pages/solicitacoes.tsx` (`.cycle-inline-link`) | "Abrir Folgas" com 19 px de altura. | **Corrigido**: 44 px. |
| `components/folgas-grid.tsx` | "+ semana" com 65×20 px e fonte de 10 px. | **Corrigido**: 36 px, 11 px. |
| `pages/escalas.tsx` · rodapé de ações (Administração) | Seis botões quebram em grupos com alinhamento diferente (1ª linha à direita, as outras à esquerda); a ação principal ("Gerar os 2 Livros") fica no meio; "Publicar conjunto · faltam 4" não diz o que é "conjunto". | Proposta: ação principal sempre por último e à direita; Folga, Troca, Regras e Gerar o mês num menu "Mais". |
| `pages/escalas.tsx` · grade "Por pessoa" | A 375 px cabe 1,3 pessoa por tela (coluna de 170 px, cabeçalho em 3 linhas), com 24 colunas. | Proposta: no celular abrir em "Por atividade". |
| `components/folgas-grid.tsx` | Dias da semana e iniciais com 9–10 px. | Já anotado no handoff; pede subir para 11 px. |
| `pages/biblioteca-gestao.tsx` | "PDF" 9 px, "Regras e políticas" 10 px. | Subir para 11 px. |
| Mensagens, Mural, Biblioteca | Campo de busca com 18–19 px de altura dentro de uma moldura maior: tocar na moldura fora do campo não foca. | Fazer a moldura ser o `<label>` do campo. |
| `pages/perfil.tsx` | Interruptor do silêncio noturno 46×27. | Área de toque de 44 px. |
| Botão da ASA (`global-asa-launcher`) | No celular fica sobre o cabeçalho, a 7 px do sino. | Aceitável; vale um respiro maior. |

## 4. Código e boas práticas

- **Desempenho — corrigido:** "Minha escala" (`GET /escalas/minha`, a tela que o Elenco mais abre) montava local por
  local em série: **10–12 s** com 5 locais no banco de teste. Agora monta em paralelo: **4–5 s**. O mesmo no Painel
  (`/panel-indicators`).
- **Conexões com o banco (alto, infraestrutura):** produção e teste usam o pooler do Supabase em **modo sessão
  (porta 5432)**, limitado a 15 clientes, e cada instância da API abre até 10 (padrão do `pg`). Dois processos já
  estouram: um teste do Meu Dia caiu com `EMAXCONNSESSION max clients reached` só por rodar junto da API local. Na
  Vercel, duas instâncias simultâneas podem fazer o mesmo e virar erro 500 no pico. O próprio `.env.example` recomenda
  a porta **6543 (modo transação)**; outra saída é `max` pequeno no `Pool` (`lib/db/src/index.ts`). Decisão de quem
  cuida de produção.
- **Gerar o mês é lento:** ~20 s por dia por local no banco de teste (cada Livro do Dia passa por várias idas ao banco).
  Funciona (a tela continua sozinha), mas um mês de 3 locais levou ~25 min.
- **Laços com `await` no banco:** 135 laços com escrita/leitura dentro; os que montam a Escala inteira por local estão
  em `checkin-reconcile.ts`, `operational-jobs.ts` (ciclo por minuto) e `shift-checkins.ts`. Mesmo padrão de correção.
- **`.catch(() => fallback)` que mente:** em `livro-do-dia.tsx`, se `/delta` falha a tela assume "sem mudanças ao vivo"
  (crivo 8); em `shows.tsx` e `operational-cycle.tsx`, falhas viram lista vazia — parece "não há", quando é "não
  carregou".
- **Edição de pessoa em 3 chamadas soltas** (`cadastros.tsx`): nome, área e perfil vão em PATCH + PUT + PUT; se a
  terceira falha, a pessoa fica meio salva.
- **Estilo:** Meu Dia, Escala e Livro do Dia são quase todo estilo inline (`css("...")`) com cores fixas (#6b6482,
  #e6e1f2…) em vez dos tokens do `index.css`; `operational-cycle.css` é uma linha só de ~10 KB. Dificulta manter
  espaçamento e cor consistentes entre telas.
- Respostas de erro com formatos diferentes (`{error}` × `{error, message}`), o que obriga a tela a adivinhar.

## 5. Verificação

- `tsc` limpo em api-server e web-admin; build do site ok; `verificar-nomes-build`: nenhum dos 51 nomes do elenco.
- No navegador (375 px e 1280 px): Meu Dia da Administração, Supervisão, Direção e Elenco; atalho "Escala de hoje ·
  Lagoa" abre em hoje na Lagoa; Elenco abre a Minha escala em hoje; Painel e Livro do Dia no computador.
- Testes da API (banco de teste), depois das mudanças: `fase-c-meu-dia`, `escalas-dia`, `escala-mes` e
  `fase-c-escala-avisos` passaram. A bateria inteira não foi rodada. (Uma primeira rodada do `fase-c-meu-dia` caiu
  pelo limite de conexões, com a API local ligada ao mesmo tempo — ver item de conexões acima.)
- **Nada foi commitado nem enviado.** Sem migração.

## 6. Como repetir

Os roteiros ficaram na pasta temporária da sessão (cliente `api.mjs`, `s1-cadastros` a `s5-rotina`). A empresa
"Cia. Horizonte de Espetáculos (fictícia)" continua no banco de teste. A operação "Parque das Águas" foi ativada direto
no banco (a API pede um checklist que nenhuma tela preenche) para reproduzir o item 2.1.
