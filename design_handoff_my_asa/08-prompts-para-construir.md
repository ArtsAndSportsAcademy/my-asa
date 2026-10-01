# Textos prontos para construir com IA

Para quem vai usar uma ferramenta que gera o app a partir de descrição (Lovable ou similar).

## Como usar

**Um passo por vez.** Cole o passo 1, espere funcionar, confira, só então vá ao 2.
Se você colar tudo de uma vez, a ferramenta inventa estrutura e você gasta mais tempo
corrigindo do que construindo.

Quando algo sair errado, não recomece: descreva o que está errado e peça a correção.

---

## Passo 1 — fundação

> Preciso de um app web interno para uma equipe artística de 40 pessoas que trabalha em parques
> temáticos. Vai ser usado principalmente no navegador do celular.
>
> Comece só pela fundação: banco de dados, login por usuário e senha, e as tabelas abaixo.
> Ainda não crie telas de funcionalidade — só o login e uma tela vazia depois de entrar.
>
> Tabelas:
> - **pessoa**: nome, usuario, senha, area_id, local_padrao_id, perfil (DIR/ADM/SUP/MEM),
>   ativa (booleano), menor_de_idade (booleano)
> - **area**: nome
> - **local**: nome, tipo (parque ou hotelaria), encerrado
> - **area_local_supervisor**: area_id, local_id, pessoa_id — uma área pode ter supervisores
>   diferentes em locais diferentes
>
> Regras importantes:
> - Não existe autocadastro. Só quem tem perfil ADM cria contas.
> - A permissão precisa ser checada no servidor, não só escondida na tela.
> - Desligar uma pessoa marca ativa = false; nunca apaga o registro.

Depois que funcionar, cadastre as pessoas reais — a lista está em `06-vocabulario-e-elenco.md`.

---

## Passo 2 — check-in (comece por aqui)

> Agora a tela de Check-in. É a que a equipe usa todo dia, no celular.
>
> Uma vez por turno, a pessoa recebe uma pergunta: "Você está no local e pronta?"
> Três respostas possíveis:
> - **Pronto** — registra e acabou
> - **Atraso** — pede a previsão de chegada; depois aparece um botão "Cheguei" que fecha
>   o registro. Sem esse botão, o turno encerra como atraso sem chegada.
> - **Falta** — pede um motivo (Enfermidade, Problema pessoal, Transporte, Outro) e um texto.
>   O motivo é obrigatório aqui.
>
> A supervisão vê quem da área dela ainda não respondeu.
> A pessoa vê o próprio histórico do mês.
>
> Se o celular estiver sem internet: **não guarde para enviar depois.** Mostre um aviso
> dizendo para avisar a supervisão por fora do app, com um botão de ligar. Se ficasse na
> fila, a supervisão veria a pessoa como quem não respondeu.
>
> Botões com no mínimo 44px de altura. Nenhum texto abaixo de 12px.

---

## Passo 3 — escalas

> Tela de Escalas com duas abas: **Programação** (o molde de como é cada dia da semana em cada
> local) e **Escala** (o dia de verdade). Entra sempre pela aba Escala.
>
> - Quem é ADM edita tudo.
> - Quem é SUP responde só pela própria área e publica a parte dela — não escreve na área de
>   outro supervisor.
> - Quem é MEM vê só "Minha escala", por dia e por semana, com o local de cada bloco.
>   Não vê o molde.
>
> A escala publica sozinha num horário que a Administração configura, desde que não haja
> pendência. Havendo pendência, não publica e avisa.
>
> Os blocos da escala usam o vocabulário da operação: TREINO GELO, ENSAIO, BOAS-VINDAS,
> ALMOÇO, MUSICAL 12:30, SHOW PATINAÇÃO 14:00, FISIOTERAPIA, e assim por diante.

---

## Passo 4 — folgas

> Tela de Folgas. Duas coisas:
>
> 1. **Turmas do mês** — grupos de pessoas que folgam juntas. As turmas são livres, montadas a
>    cada mês, não fixas. Precisa de um botão "repetir a configuração do mês anterior".
> 2. **Pedidos** de folga e de troca, com aprovar e negar. **Negar exige motivo escrito.**

---

## Passo 5 — shows e personagens

> Agora a parte mais específica. Dois conceitos que não podem se misturar:
>
> **Livro do Show** é o padrão ideal: como o show funciona se todo mundo está presente.
> Tem cenas, sessões com começo e fim, e um interruptor "usa personagens".
> **Nunca muda por causa de um dia específico.**
>
> **Livro do Dia** é a cópia editável daquele show numa data. Nasce herdando tudo do Livro do
> Show, já 80% resolvido — a pessoa confere, não refaz. Quando alguém falta, puxa o substituto.
>
> **Personagens**: cada personagem pertence a um local e tem um modo, escolhido por quem
> configura:
> - **Titular com substitutos** — fila ordenada; se o titular falta, cai para o próximo
> - **Rodízio** — entra quem menos fez; um contador por pessoa, que soma 1 por dia (não por sessão)
>
> Quando um show usa personagens, escolhe-se o local, abre-se a lista de personagens daquele
> local, e agrega-se ao show. Assim, se Astrid está no musical e no show de patinação, o Livro
> do Dia dos dois mostra **a mesma pessoa**, não duas pessoas diferentes.
>
> **Regra que não pode faltar**: se a mesma pessoa for escalada em dois shows com horário
> sobreposto, o app avisa e a pessoa resolve. O app nunca resolve sozinho. O aviso aparece
> ao montar o show e ao gerar o Livro do Dia.

---

## Passo 6 — formações

> Dentro do módulo Livro do Dia, uma **biblioteca de formações** (disposições de palco).
>
> Indexe por **quantidade de pessoas** — é assim que se busca: "preciso de uma formação para 7".
> Não são sempre as mesmas pessoas; o que se repete é o número.
>
> Uma formação vale para o dia inteiro. Se alguém falta só numa sessão, o app avisa e a pessoa
> ajusta manualmente.
>
> Quando uma lacuna não tem solução, **deixe em branco e sinalize** que precisa resolver.
> Pode sugerir formações passadas com a mesma quantidade. **Nunca preencha sozinho.**
>
> Um botão só para confirmar o livro do dia.

---

## Passo 7 — mural e mensagens

> **Mural de avisos**: quem publica escolhe os destinatários (uma área, um local, ou todos).
> Cada pessoa confirma que viu. **Cancelar um aviso já publicado exige motivo.**
>
> **Mensagens**: grupos criados automaticamente por área e por local, mais grupos soltos.
>
> Isto substitui o WhatsApp da operação — se não existir, os avisos continuam lá e o app só
> soma trabalho.

---

## Passo 8 — o resto

Agenda, Biblioteca, Painel, Reconhecimentos, Responsabilidades, Pessoas, Áreas, Locais.
Descreva cada uma a partir de `04-telas.md`.

---

## Regras para repetir sempre

Cole junto com qualquer passo, sempre que a ferramenta esquecer:

> Lembretes que valem para o app inteiro:
> - Nenhum texto abaixo de 12px. Nenhum botão abaixo de 44px de altura.
> - Datas sempre calculadas a partir de hoje — nunca escritas à mão.
> - Toda tela precisa mostrar que está carregando, e o que dizer quando falha.
> - Ações que não dão para desfazer pedem confirmação.
> - Permissão checada no servidor, não escondida na tela.
> - Use os nomes reais da equipe, nunca nomes de exemplo.
> - Sem emoji.

---

## Quando travar

Volte à conversa onde este pacote foi feito, diga em que passo está e o que aconteceu.
Cole a mensagem de erro se houver. É mais rápido que tentar adivinhar.
