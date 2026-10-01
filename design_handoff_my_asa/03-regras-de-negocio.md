# Regras de negócio

Decididas com a dona do produto. **Não reabrir sem conversar.**

> **Método**: quando o código antigo tiver comportamento que este documento não menciona, ele
> é marcado como *não decidido* e levado para conversa — nunca removido por parecer complicado.
> O modelo vem de um piloto que rodou de verdade; o jeito simples já falhou.

> **Entidades próprias, não campos genéricos**: Personagem, Elenco, Sessão, Formação e
> Ocorrência são entidades com identidade, estado e ciclo de vida. Concentrá-las em linhas
> genéricas foi o que o piloto mostrou não funcionar.

## Personagens

Cada personagem pertence a um local e tem um modo, escolhido por quem configura:

- **Titular com substitutos** — fila ordenada; se o titular falta, cai para o próximo.
- **Rodízio por quem menos fez** — entra quem tem o menor contador. No primeiro rodízio vale a
  ordem da lista; depois, sempre quem menos fez.

**O contador soma 1 por dia**, não por sessão. Quem faz Astrid no musical e no show de
patinação no mesmo dia soma 1.

### Por que a tela de Personagens existe

Para **não ter que abrir todos os livros** e conferir se é a mesma pessoa no personagem
naquele dia. É uma tela de consulta, não de configuração de escala.

### Conflito — regra confirmada, implementação pendente

Quando a mesma pessoa é escalada em dois shows com horário sobreposto, **o app avisa e a
pessoa resolve**. O app nunca resolve sozinho. O aviso precisa aparecer em dois momentos:
ao montar o show e ao gerar o Livro do Dia.

Exemplo real: Sarah como Astrid no musical das 12:30 e Astrid no Show Patinação das 14:00 —
se os horários se sobrepuserem, avisar.

O alerta **não bloqueia a publicação**. Há dias em que o conflito é conhecido e aceito pela
operação; nesse caso, a pessoa responsável decide como prosseguir.

### Não repetir pessoa na mesma cena

Uma pessoa não pode ocupar duas posições na mesma cena ao mesmo tempo. É regra física da
operação e se preserva mesmo quando não há outra pessoa elegível:

- o sistema não duplica a mesma pessoa silenciosamente;
- sem alternativa, a lacuna fica em branco e sinalizada para ajuste humano;
- vale na montagem do Livro do Show e na geração do Livro do Dia.

## Livro do Show × Livro do Dia

**Livro do Show é o ideal intocado**: como o show funciona se todo mundo está presente.
Nunca muda por causa de um dia.

**Livro do Dia é a cópia editável** daquela data. Verifica quem está de fato presente e,
quando falta alguém, puxa o substituto de cada cena e formação.

O primeiro Livro do Dia herda tudo do Livro do Show. Como todo dia folgam 2 ou 3 pessoas
diferentes, algumas formações se repetem, outras não, e às vezes surgem novas (alguém doente).

### Ao gerar

- Nasce **80% resolvido** — a pessoa confere, não refaz.
- Lacuna sem solução fica **em branco, sinalizada**, com aviso do que falta resolver.
  Pode **sugerir formações passadas** com a mesma quantidade de pessoas. Nunca preenche sozinho.
- **Um botão só** para confirmar o livro.
- Pode ser gerado por show e data **sem existir evento prévio na Agenda** — o show acontece
  independentemente de alguém ter lembrado de criar o evento.
- Depois de gerado, o livro e os convocados **aparecem na Agenda** de quem foi convocado.
  A Agenda reflete a operação; não autoriza nem impede a geração.

### Shows só de personagens

Alguns shows precisam apenas da lista de quem faz cada personagem naquele dia. O Livro do Dia
desses shows é só essa lista — sem cenas, sem formações.

## Sessões

Sessões têm **começo e fim** (ex.: 10:00–11:00 e 16:00–17:00).
**Horário de chamada é opcional**, nunca obrigatório.
Uma formação vale para o dia inteiro; se alguém falta só em uma sessão, o app avisa e a
pessoa ajusta manualmente.

## Formações

Biblioteca **dentro do módulo Livro do Dia**, não numa biblioteca genérica — é lá que se
consulta. Precisa ser bem organizada.

**Indexada por quantidade de pessoas.** Não são sempre as mesmas pessoas; o que se repete é
o número. "Preciso de uma formação para 7" é a busca real.

## Escalas

- Publica **sozinha, no horário que a Administração define**, se não houver pendência.
- Havendo pendência, **não publica** e avisa.
- O horário é **configurável**, não fixo.
- Um conflito conhecido é alerta humano e, por si só, não é pendência que bloqueie a publicação.
- A aba Livro do Dia dentro de Escalas é atalho para o módulo 14, não conteúdo próprio.
- **No lançamento a Administração publica manualmente.** A publicação automática continua
  decidida, mas adiada para depois de o app estar estável.

## Folgas

**Turmas livres**, não fixas A/B/C. Precisa do botão **"repetir a configuração do mês anterior"**.

## Motivo obrigatório — só nestes 4 casos

1. Negar pedido de folga ou troca
2. Registrar ausência ou ocorrência
3. Cancelar um aviso já publicado
4. Reabrir um local encerrado

Mais dois, decididos depois por serem destrutivos:
5. Desligar uma pessoa
6. Trocar o perfil de acesso de alguém

**Em todo o resto o motivo é opcional.** Quando em branco, o registro guarda o reflexo
calculado da mudança (o que mudou, de que para quê).

## Check-in

Uma pergunta, um toque, uma vez por turno. Três respostas: pronto, atraso, falta.
Atraso pede previsão de chegada e só fecha com "Cheguei".

**Sem sinal**: o app não guarda para enviar depois. Instrui avisar a supervisão por fora,
com botão de ligar. Se ficasse na fila, a supervisão veria a pessoa como quem não respondeu.

## Escrita concorrente

O livro aberto dentro da Escala e o módulo 14 editam **o mesmo registro**. O servidor precisa
detectar quando alguém alterou o livro depois que ele foi aberto. Ao salvar: avisar o conflito,
mostrar o que mudou, e deixar a pessoa escolher. **Nunca sobrescrever em silêncio.**

O histórico guarda a versão anterior e a nova, com quem, quando e o que mudou. A última
alteração só prevalece quando a pessoa escolhe explicitamente sobrescrever.
