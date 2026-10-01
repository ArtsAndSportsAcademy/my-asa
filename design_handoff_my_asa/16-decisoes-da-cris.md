# As cinco decisões da Cris — recomendação

> **TODAS DECIDIDAS em 17/09/2026.** A operação concordou com as cinco recomendações, com uma
> ressalva na 1: **começar nos planos gratuitos da Vercel e do Supabase e migrar depois**, em
> vez de já contratar. Ver a nota no fim da seção 1.

Nenhuma é técnica. Todas travam o lançamento se ficarem abertas, e três delas ficam mais caras
depois que o app estiver em uso. Abaixo, o que eu recomendaria e por quê — para a Cris decidir,
não para substituir a decisão dela.

---

## 1 · Onde hospedar e quanto custa por mês

**Recomendação: ficar onde já está — Vercel para o app, Supabase para o banco — e pagar o
plano do banco.**

O app já roda nos dois. Trocar agora não resolve problema nenhum e adia o lançamento.

O que importa não é o valor, é **o que o plano grátis não faz**: bancos gratuitos costumam
pausar por inatividade e guardam pouco tempo de cópia de segurança. Para um app onde a escala
de amanhã é trabalho real de quarenta pessoas, isso não serve — o dia que você precisa da cópia
é justamente o dia ruim. Confirme os valores atuais na página de planos dos dois serviços; a
ordem de grandeza é de dezenas de dólares por mês, não centenas.

Ponto de comparação útil: **é menos do que custava o app de loja que foi descontinuado** — e
entrega mais, porque não depende de revisão da Apple para publicar uma correção.

Uma coisa a verificar: o plano gratuito da hospedagem costuma ser só para uso não comercial.
Vale ler os termos antes, não depois.

### DECIDIDO — começar no grátis, com gatilho definido

A operação optou por **começar nos planos gratuitos da Vercel e do Supabase** e contratar
depois, conforme o uso crescer. É uma posição coerente para o piloto, por um motivo específico:
a regra de que **a escala do dia também sai no papel** já protege a semana 1. Se o banco sumir,
o dia acontece do mesmo jeito.

O que o plano grátis não dá, para não ser descoberto no pior dia:

- **Não há cópia de segurança recuperável.** Dado perdido ou apagado errado não volta.
- O banco pausa por inatividade — irrelevante durante o piloto, que é uso diário.

**Gatilho para contratar**, para não ficar vago: quando a **segunda área** entrar (Acquamotion
ou Produção), **ou** quando o papel deixar de ser impresso — o que vier primeiro. Nesse momento
o app virou o original, não a cópia, e o contador de rodízio passa a ser memória que ninguém
reconstrói de cabeça.

**Enquanto for grátis**: um comando de exportar o banco, rodado semanalmente pela Barbara e
guardado fora do Supabase. Não é backup de verdade, mas tira o caso "perdi tudo" da mesa.

---

## 2 · Quem atende quando cai num domingo de show

**Recomendação: ninguém de plantão — e assumir isso em voz alta.**

Um app de quarenta pessoas não sustenta plantão de fim de semana, e prometer um que não existe
é pior que não ter: a operação confia, o app cai, e ninguém atende.

O que fazer no lugar, e isto é **requisito de lançamento, não contingência**:

- **Um botão de imprimir a escala do dia.** A escala do dia existe fora do app — impressa no
  camarim ou mandada no grupo na véspera. O app é onde a escala *nasce*, não o único lugar
  onde ela *vive*.
- **Um contato único** para problema de app — a Barbara — em horário comercial, sem promessa
  de fim de semana.
- Durante a primeira semana do piloto, resposta no mesmo dia. Depois disso, horário comercial.

Assim, o app cair num domingo é chato, não é crise. É a diferença entre um sistema que a
operação adota e um que ela nunca larga o papel por não confiar.

---

## 3 · Quanto tempo os dados ficam guardados

**Recomendação: separar em duas famílias, com relógios diferentes.**

**O que fica para sempre** — é a memória da operação, e apagar destruiria o próprio app:
quem trabalhou, em que dia, em que show, em que personagem; contadores de rodízio; escalas e
Livros do Dia publicados; documentos da Biblioteca. É por isso que o pacote inteiro proíbe
apagar e manda desativar.

**O que tem prazo** — porque é dado pessoal sensível e o valor dele acaba rápido:

| Dado | Proposta |
|---|---|
| Texto do motivo de falta | apaga o **texto** depois de 12 meses; o registro de que houve falta fica |
| Descrição de ocorrência resolvida | mesma coisa: 12 meses depois, some o texto, fica o fato |
| Registro de auditoria | 24 meses |
| Mensagens diretas | 12 meses |

A lógica: a operação precisa saber **que** a pessoa faltou em 12 de março — isso é escala. Não
precisa guardar para sempre **que ela estava com um problema de saúde**. Manter é risco sem uso.

Isto é LGPD na prática. Não é parecer jurídico — se houver alguém que cuide de contratos na
casa, vale mostrar esta tabela antes de ligar.

---

## 4 · Quem é o responsável nomeado pelos dados

**Recomendação: Barbara Sorroche no dia a dia, Cris Garcia como responsável final.**

A Barbara já é quem cria conta, troca perfil e desliga pessoa — ela **já** é a dona operacional
dos dados, com ou sem título. Nomear é só reconhecer o que já acontece, e dá a ela respaldo
para dizer não quando alguém pedir acesso a algo que não deveria ver.

A Cris responde formalmente — é quem assina, e quem decide em caso de dúvida.

O que o nome significa na prática: é para essa pessoa que alguém do elenco pergunta *&ldquo;quem
viu o meu atestado?&rdquo;*, e é ela que pede a exclusão de um dado quando alguém sai da casa e
pede. Sem nome, essa pergunta não tem endereço.

---

## 5 · &ldquo;Tem certeza?&rdquo; ou &ldquo;desfazer&rdquo;

> **DECIDIDO em 17/09/2026 — aprovado como recomendado abaixo.** Entra no Bloco 7.

**Recomendação: os dois, divididos por uma regra só — dá para voltar atrás sozinho?**

**&ldquo;Desfazer&rdquo;** (a ação acontece, e fica 10 segundos uma faixa com *Desfazer*) para o
que se usa o dia inteiro e não sai do app:

- desativar formação
- arquivar documento
- remover pessoa de um grupo
- negar folga

**&ldquo;Tem certeza?&rdquo;** para o que sai do app e não tem como recolher:

- **cancelar aviso já publicado** — já chegou no celular de todo mundo
- **desligar pessoa** — corta o acesso na hora, derruba a sessão
- **trocar o perfil de alguém**
- **reabrir local**

Estes quatro já exigem motivo escrito. O motivo *é* a confirmação: quem precisa escrever por
quê já parou para pensar. Não peça &ldquo;tem certeza?&rdquo; **e** motivo em telas separadas —
peça o motivo, e o botão de confirmar fica ali.

### O detalhe que faz isto funcionar

**Quando a ação manda notificação, a janela de desfazer e o atraso da notificação são a mesma
coisa.** Negar uma folga com 10 segundos de desfazer não adianta nada se o aviso já saiu no
primeiro segundo — a pessoa já leu no celular. Segure o envio até a janela fechar.

É uma linha de código e resolve o problema inteiro: o que dá para desfazer ainda não saiu do
app; o que já saiu, não dá para desfazer — e por isso pergunta antes.

---

## O que trava o quê

| Decisão | Trava o lançamento? | Fica mais caro depois? |
|---|---|---|
| 1 · Hospedagem | **sim** — precisa do plano pago antes do dado real entrar | não |
| 2 · Plantão | **sim** — o botão de imprimir é requisito | sim, muito |
| 3 · Retenção | não, mas decida antes de 12 meses de uso | sim |
| 4 · Responsável | não, mas é a pergunta sem endereço até ser decidida | não |
| 5 · Confirmar/desfazer | **sim** — muda como cada tela é construída | sim, muito |

As duas que eu resolveria esta semana são a **1** e a **5**. A 5 principalmente: ela não é
detalhe de acabamento, é decisão de arquitetura — atrasar a notificação para caber a janela de
desfazer é coisa que se constrói junto, não se adiciona depois.
