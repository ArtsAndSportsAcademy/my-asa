# Restrição de horário, limite de shows por dia e rodízio do Teatro de Natal — desenho

Conversa com a Babi em 16/10/2026. Nada disto foi construído. **Marcado "decisão dela"** é o que ela
disse; **"minha decisão"** é escolha de quem desenhou, para ela conferir.

## Por que isto existe

O Natal começa em 22/10/2026. No Snowland, o Teatro de Natal tem duas sessões por dia (11:30 e
15:30), cada uma com duas vagas de personagem: **Jingle** e **Bell**. São 4 vagas por dia, e a regra
da casa é que cada pessoa faça **uma** sessão por dia.

Quem faz teatro também faz os outros shows do dia: Boas-vindas de Natal 10:00, Teatro 11:30, Musical
12:30 (outro elenco, não entra), Patinação 14:00, Show da Montanha 15:15 e Teatro 15:30. O risco real é
alguém ficar com shows demais e correndo entre um e outro.

Quatro pessoas só fazem teatro: **Sofia, Esther, Daia e Kauã**. **Julia e Bel** também entram, mas
fazem a montanha e precisam revezar para não acumular.

O app já resolve o rodízio por "quem fez menos" e já mede a carga do dia, da semana e do mês entre
todos os shows do local. Faltam três coisas, e todas valem para **qualquer pessoa e qualquer show**,
não só para o teatro (decisão dela).

## O que o app já faz (não mexer)

- Escolhe cada vaga pela fila (titular, depois rodízio por quem fez menos), pulando quem está de
  folga, recesso ou restrição por período (`line-resolver.ts`, `character-rotation.ts`).
- Evita repetir a pessoa em outra posição da mesma cena.
- Prefere quem tem menos shows no dia, na semana e no mês; supervisor vai para o fim da fila.
- O contador do rodízio só avança na publicação do dia.

## O que passa a existir

### 0. Sessão separada (decisão dela, 16/10/2026)

Hoje há **um Livro do Dia por show por dia**, e as sessões só marcam horário: a formação vale para o dia
inteiro. Para o Teatro de Natal ter pessoas diferentes às 11:30 e às 15:30, a sessão ganha uma escolha.

- **Um show só**, "Teatro de Natal", com as duas sessões dentro dele (decisão dela).
- Ao **adicionar uma sessão**, o app **pergunta se ela é separada** (decisão dela). Texto da pergunta,
  que explica a regra: "Esta sessão tem as próprias vagas e as próprias pessoas? Se sim, o Livro do
  Dia dela é separado dos outros horários deste show."
- **Sessão não separada:** continua como hoje, no Livro do Dia do show para o dia inteiro.
- **Sessão separada** (minha decisão, a Babi aprovou em 16/10): vira **um Livro do Dia próprio**, com a
  hora no nome ("Teatro de Natal · 11:30"). Os personagens (Jingle e Bell) e a fila do rodízio são os
  **mesmos do show**, compartilhados entre as sessões; só o Livro e as pessoas do dia são separados.
- Um show pode misturar: as sessões não separadas dividem o Livro do dia; cada separada tem o seu.
- Sessão separada nasce sem pessoas fixas: o rodízio e as regras abaixo decidem quem faz cada uma.
- Desfazer: tornar a sessão "não separada" de novo não apaga o Livro dela. Livro que já tem pessoas ou
  já foi publicado fica como está e a tela explica; só um Livro em rascunho sem ajuste à mão se
  junta de volta ao do dia (minha decisão, a confirmar com a Babi).

### 1. Restrição de horário por pessoa — proibição, com exceção do dia

Cadastro: **pessoa, dias da semana, faixa do dia, período em que vale, motivo**. Exemplo real:
*Sofia, segunda a sexta, só pode a partir das 15:00, de tal data a tal data, "escola".*

- É **proibição** (decisão dela): o app nunca gera a pessoa fora do que a restrição permite.
- **Exceção do dia** (decisão dela): se a Sofia não tem aula num dia, a Administração ou a Supervisão
  da pessoa libera **aquele dia**, com motivo escrito. Vale só para aquele dia e fica no Registro.
  Minha decisão: liberar faz a pessoa **voltar a ser opção** naquele horário, mas o app não a escala
  sozinho; quem libera escolhe na Escala.
- Quem cadastra e quem libera (decisão dela): **Administração** e a **Supervisão da própria área da
  pessoa**. Supervisão de outra área recebe recusa com a frase "essa pessoa é de outra área".
  Direção só lê.
- Aviso (minha decisão, pelo crivo): quando alguém cria ou libera uma restrição, a Administração e a
  Supervisão da pessoa recebem um aviso no sino. Um aviso por acontecimento.
- A pessoa restrita vê a própria restrição na Minha escala, com o motivo, para não achar que sumiu
  da escala por engano.

### 2. Limite de shows por pessoa por dia — configurável por local

- O limite é um número **configurável pela Administração, por local** (decisão dela): **3 no
  Snowland**; o Acquamotion pode ter outro. Um local sem número configurado não tem limite.
- É **proibição** (decisão dela): o app não gera a pessoa acima do limite.
- **Mas pode ser passado à mão, sem burocracia** (decisão dela): se alguém fica mal de última hora e
  outra pessoa precisa fazer 4, a Administração ou a Supervisão ajusta a célula e pronto. Minha
  decisão: pede o motivo escrito (igual às outras exceções), o Registro grava, e a Administração é
  avisada no sino — sem tela de aprovação, para não atrasar quem está no parque.

### 3. Uma sessão por dia no mesmo show, e shows colados

- **Mesmo show, duas sessões separadas:** como cada sessão separada é um Livro do Dia, o app evita
  repetir a pessoa na sessão da tarde se ela fez a da manhã (pela carga do dia, que já existe), e só
  repete se **não houver mais ninguém** (caso da quarta e da quinta em novembro, quando só a Esther
  sobra entre os fixos e a Julia e a Bel completam). Quando repete, o rodízio **alterna** quem faz as
  duas sessões (decisão dela).
- **Shows colados** (a Montanha dura 5 min e começa às 15:15, o Teatro às 15:30): **não é proibido**
  (decisão dela: "dá para fazer, mas fica corrido"). O app trata como **evitar**: prefere quem não
  está no show colado e só junta os dois se faltar gente. Minha decisão: "colado" é configurável por
  local como um intervalo mínimo em minutos entre o fim de um show e o início do outro; sugestão de
  partida, 20 minutos, a Babi ajusta.

## O que NÃO entra

- Peso diferente por show (a Montanha de 5 min contando menos que o Musical). Cada show conta 1. Se o
  limite de 3 incomodar, volta como pedido novo.
- Preferência ("a Julia gosta de manhã"). Aqui só entra o que **não pode** (restrição) ou o que o
  local quer limitar.
- Montar o rodízio de novembro em diante. Os grupos de folga já resolvem as folgas; o desenho vale,
  mas a tabela de novembro se gera depois com este recurso pronto.

## Anti-objetivos (seria falha mesmo funcionando)

- O app escalar a Sofia às 11:30 de uma segunda por não saber da aula.
- Uma exceção do dia sumir sem aparecer no Registro.
- Alguém ficar de fora do aviso: a Supervisão da pessoa descobrir só olhando a tela.
- Não conseguir cobrir um dia de emergência porque o limite travou. A Administração e a Supervisão
  sempre conseguem passar do limite, com o motivo.

## O crivo, passo a passo

1. **Várias pessoas ou dias:** a restrição guarda vários dias da semana de uma vez e o cadastro aceita
   várias pessoas com a mesma regra (por exemplo, todas as que têm escola de manhã).
2. **Quem pode e a recusa que explica:** Administração e Supervisão da própria área; os outros
   recebem a frase de por que não.
3. **Telefone:** o cadastro e a exceção se conferem a 375 px, com rodapé de confirmar e cancelar sempre
   à vista (pergunta 16).
4. **Quem fica sabendo:** sino para Administração e Supervisão da pessoa, um por acontecimento.
5. **Registro:** toda escrita grava `writeHistoryEvent` na mesma transação, com o motivo nas exceções.
6. **Depois de publicado:** restrição nova ou exceção em dia já publicado **espera a republicação**; a
   Administração é avisada de que há o que republicar.
7. **Desfazer:** restrição se encerra (não se apaga) e volta; exceção do dia se desfaz antes de
   publicar. Remoção é lógica.
8. **Mensagem verdadeira:** quando o app não consegue gerar a vaga por causa de restrição ou de limite,
   a tela diz qual regra impediu e de quem ("Sofia: só a partir das 15:00, escola").
9. **Falha de rede:** a exceção não se perde ao falhar; a tela mostra o que não foi salvo.
10. **Vazio:** local sem limite configurado diz "sem limite", não fica mudo; pessoa sem restrição
    mostra "nenhuma restrição".
11. **Onde a tela abre:** a restrição fica no perfil da pessoa e, dentro da Escala, em quem foi
    pulado pela regra.
12. **Linhas diferentes:** na lista de restrições aparecem pessoa, dias, horário e período.
13. **Texto no contexto:** o texto da Escala explica a regra ("não escalada às 11:30: restrição de
    horário") em vez de só mostrar a vaga vazia.
14. **Enquanto espera:** gerar com as novas regras mostra andamento; banco lento não pode virar clique
    repetido.
15. **Sair sem salvar:** Esc fecha o cadastro e a exceção.

## Dados (minha decisão, a confirmar no plano)

Tabela nova de restrição de horário (pessoa, dias da semana, hora inicial e final permitidas,
período, motivo, quem criou, encerrada ou não) e exceção por dia (pessoa, data, motivo, quem liberou).
Configuração por local: limite de shows por dia e intervalo mínimo entre shows. Migração só no
banco de teste, com rollback em `lib/db/drizzle/rollback/` e registro no `_journal.json`; quem roda
em produção é quem constrói o app.

## Como se prova que funciona

Uma empresa de teste com o caso real: Sofia restrita a tarde de segunda a sexta, Teatro de Natal com
duas sessões e as vagas Jingle e Bell, Julia e Bel também na Montanha, limite 3. Gerar 22 a 31/10 e
conferir: Sofia nunca de manhã em dia de semana, ninguém acima de 3, ninguém em duas sessões do teatro
exceto onde não há outra pessoa, Julia e Bel só onde falta gente.

A tabela de 22 a 31/10 combinada na conversa serve de **referência de leitura**, não de resultado
esperado palavra por palavra: o app escolhe por quem fez menos e pode divergir sem estar errado, desde
que respeite as regras acima.

## Deixado para quem for planejar

- Como o app define "faixa do dia" (por hora do show ou por turno manhã/tarde). Sugestão: por hora
  inicial do show, porque é o que existe no cadastro.
- Onde a tela de restrições mora no menu.
- Ordem de geração: gerar a Montanha antes do Teatro para a carga do dia já contar.
- Pendência de cadastro, não de código: **Jingle e Bell (Teatro de Natal) ainda estão "a definir" na
  planilha**; sem elas, o Livro do Dia do teatro nasce vazio. Precisa da lista de quem pode fazer
  cada uma.
