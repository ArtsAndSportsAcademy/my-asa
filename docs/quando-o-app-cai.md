# Quando o app cai: "o alerta tocou, e agora?"

Este guia é para quem não é de programação. Siga na ordem. Cada passo diz **o que olhar**, **o que a tela mostra** e **o que fazer**.
Se em algum passo você não tiver certeza, pare e vá para o passo 6 (avisar quem constrói o app). Não mexa em nada que não esteja
escrito aqui.

## Antes de tudo: que alerta foi?

| O que chegou | O que quer dizer | Vá para |
|---|---|---|
| E-mail do verificador (Better Stack): "my-asa está fora do ar" | O endereço de saúde não respondeu, ou respondeu "erro" | Passo 1 |
| Aviso no sino: **"O relógio do sistema parou"**, ou a faixa vermelha no Painel | O app abre, mas a tarefa que roda a cada minuto (lembretes de check-in, publicação automática, entrega de avisos) parou | Passo 3 |
| Aviso no sino: **"O relógio do sistema voltou"** | Resolveu sozinho. Os lembretes do tempo parado podem não ter saído | Passo 5 |
| Alguém do elenco avisa "não consigo entrar" | Pode ser o app, ou só a senha da pessoa | Passo 1 |
| E-mail do Sentry com **`EMAXCONN max client connections reached, limit: 200`** (e, junto, o verificador dizendo `"banco_fora"`) | O banco recusou conexões novas por uns minutos: foi um pico de uso, não um defeito. Costuma passar sozinho | Seção "Limite de conexões" no fim |

## Passo 1 — O app está no ar? (30 segundos)

1. No navegador, abra: **https://my-asa.vercel.app/api/saude**
2. O que a tela pode mostrar:
   - `"status":"ok"` → o app e o banco respondem e o relógio está em dia. O problema é de outra pessoa ou de outra tela: vá para o passo 6.
   - `"status":"relogio_parado"` → o app responde, mas o relógio parou. Vá para o passo 3.
   - `"status":"banco_fora"`, ou a página nem abre, ou aparece erro do Vercel → vá para o passo 2.
3. Abra também o site (**https://my-asa-web.vercel.app**). Se o site abre mas as telas dizem "não consegui carregar", o problema está na API: é o mesmo caso do passo 2.

## Passo 2 — Olhar o Vercel (o servidor do app)

1. Entre em **vercel.com** com a conta da Academia e abra o projeto **my-asa** (a API). O site é o projeto **my-asa-web**.
2. Clique em **Deployments**. O que mostra:
   - O primeiro da lista com bolinha **verde** ("Ready") e "Production": o último envio está no ar. Se ele é de poucos minutos atrás, **foi ele que quebrou** → faça o passo 4 (voltar o envio anterior).
   - Bolinha **vermelha** ("Error"/"Failed"): o envio novo nem subiu. O app continua no envio verde anterior; não precisa voltar nada, só avisar quem constrói o app (passo 6).
3. Clique em **Logs** (menu do projeto) e olhe as linhas vermelhas mais recentes. Copie a primeira frase de erro para mandar no passo 6. **Nunca copie senha, chave ou token** que apareça.

## Passo 3 — O relógio parou: olhar o Supabase (o banco)

O relógio é uma tarefa do banco de dados que chama o app a cada minuto. Se o app está bem mas o relógio parou, quase sempre o problema está aqui.

1. Entre em **supabase.com** e abra o projeto do My ASA.
2. Olhe a primeira tela (**Project Overview**). O que mostra:
   - Aviso de **"paused"/"pausado"** ou de banco indisponível → o banco está parado. Clique em **Restore/Resume** se o botão existir. Se o botão não existir ou não resolver, passo 6.
   - Tudo normal → siga.
3. No menu lateral, abra **Integrations** → **Cron** (ou **Database** → **Cron Jobs**). Procure o trabalho **myasa-ciclo**:
   - Ele deve estar **ativo** e a última execução deve ser de menos de 2 minutos atrás.
   - Última execução com **"failed"** ou com mensagem de erro/timeout → anote a mensagem e vá para o passo 6.
   - Última execução bem antiga e o trabalho aparece **desligado** → passo 6 (quem constrói o app roda o `agendador-supabase.sql` de novo; não é você que mexe).
4. Se o ciclo falhou porque o app estava fora, volte ao passo 2.

## Passo 4 — Voltar o envio anterior (desfazer o último deploy)

Faça **só** se o passo 2 mostrou que o app quebrou logo depois de um envio novo.

1. No Vercel, projeto **my-asa**, aba **Deployments**.
2. Procure o envio **anterior** ao que quebrou, com bolinha verde ("Ready").
3. Clique nos **três pontinhos (⋯)** daquele envio → **Promote to Production** (em português: "Promover para produção"; também aparece como **Instant Rollback**).
4. Confirme. Em cerca de um minuto, abra de novo **https://my-asa.vercel.app/api/saude**: tem que mostrar `"status":"ok"`.
5. Se o site (**my-asa-web**) também quebrou, repita no projeto dele.
6. Avise quem constrói o app (passo 6) que você voltou o envio — ele precisa saber para não promover o mesmo envio de novo.

Voltar o envio **não apaga dado nenhum**: escalas, livros e avisos ficam no banco.

## Passo 5 — Depois que voltou: quem ficou sem aviso?

Quando o relógio fica parado, **não saem sozinhos**: lembrete de check-in, publicação automática de escala, entrega de avisos da fila.

1. O aviso "O relógio do sistema voltou" diz quantos minutos ficou parado.
2. Se o tempo parado pegou **o horário de um show ou de um turno**: abra o **Painel** e a **Escala** do dia e veja quem ainda não fez check-in. Chame essas pessoas **por fora** (telefone ou grupo da equipe).
3. Se uma escala tinha prazo de publicação automática nesse intervalo, abra **Escalas** e confira: ela publica sozinha no primeiro minuto depois da volta; se ainda aparecer "Rascunho", publique à mão.
4. Se o aviso é do app e o horário já passou, **não precisa reenviar**: o aviso entregue tarde ainda aparece no sino.

## Passo 6 — Quem avisar

1. **Quem constrói o app**: é quem resolve de verdade (roda ajuste no banco, promove a correção). Mande: o que o alerta dizia, a hora, o que você viu no `/api/saude`, e a primeira frase vermelha do Log do Vercel (sem senha nem chave).
2. **A Administração da Academia**: se for no dia de show, avise que o app está instável e que o check-in pode precisar ser feito **no papel ou por mensagem** até voltar.
3. **O elenco**: um aviso curto por fora (grupo da equipe) diz que o app está passando por um problema e que a escala do dia continua valendo como foi publicada.

## O que NÃO fazer

- Não apague o projeto, o banco, nem uma "variável de ambiente" no Vercel ou no Supabase tentando "limpar".
- Não cole senha, chave ou token em nenhuma conversa, nem aqui.
- Não rode migração, nem mexa na tabela de nenhuma pessoa. Isso é com quem constrói o app.

## Como o alerta funciona (para saber o que esperar)

- Um **verificador de fora** (Better Stack) abre `/api/saude` a cada poucos minutos. Se vier erro, ele manda e-mail.
- Quando o relógio passa de **3 minutos** sem rodar, quem olhar primeiro (o verificador, ou a Administração abrindo o Painel) faz o app gravar **um aviso no sino da Administração** — um por parada, não um por minuto — e o Painel mostra a faixa vermelha.
- Quando o relógio volta, a faixa some sozinha e chega o aviso de que voltou.
- O endereço `/api/saude` **não mostra nome nem dado de ninguém**: só se o app e o banco respondem e há quantos segundos o relógio rodou.

## Limite de conexões (`EMAXCONN`): o pico que passa sozinho

**O que foi (26/10/2026, 19:45):** o banco de produção recusou conexões novas por alguns minutos ("máximo de 200 conexões atingido"). O verificador respondeu `banco_fora`, o Sentry avisou erro em `/api/saude`, `/api/meu-dia` e `/api/internal/ciclo`, e as telas mostraram "não consegui carregar". Minutos depois tudo estava em dia; nada foi perdido.

**Por que acontece:** cada cópia da API que a Vercel liga abre até 10 conexões com o banco, e num pico a Vercel liga muitas cópias de uma vez. O plano grátis do Supabase aceita 200.

**O que fazer:**
1. Abra **https://my-asa.vercel.app/api/saude**. Se mostra `"status":"ok"`, passou: não precisa fazer mais nada.
2. Se voltar a acontecer sem ninguém ter mexido em nada, quem constrói o app limita as conexões por cópia: na Vercel, projeto **my-asa** (a API), em *Settings → Environment Variables*, criar **`DB_POOL_MAX`** = **`3`** em *Production* e promover a API de novo (o código já lê essa variável, em `lib/db/src/index.ts`). Com 3 por cópia cabem muito mais cópias antes de chegar aos 200.
3. Se continuar mesmo assim, o assunto vira o plano pago do Supabase (`docs/para-a-cris-o-que-vale-pagar.md`).

Quem escreve muita coisa seguida em produção (por exemplo, cadastrar uma fila em vários personagens) deve ir com pausas: cada salvamento recarrega a tela e puxa várias consultas.
