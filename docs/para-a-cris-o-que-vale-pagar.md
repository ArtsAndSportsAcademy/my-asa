# Para a Cris: o que vale pagar para o My ASA ficar mais seguro

Escrito em 23/10/2026, em linguagem simples. Hoje o app funciona inteiro com serviços **gratuitos**. Alguns deles têm limites que, para um app usado por
gente de verdade no dia do show, valem a pena tirar. Os valores abaixo são os que eu conheço e **podem ter mudado: confirmem na página de preços de cada um**
antes de decidir.

## Em uma frase

O que mais importa pagar é o **plano do banco de dados (Supabase)**, porque é ele que faz **backup automático**. Sem ele, se os dados se perderem, não há como voltar.

## Em ordem de importância

| # | O quê | Por que vale | Custo aproximado (confirmar) |
|---|---|---|---|
| 1 | **Supabase, plano Pro** (o banco de dados) | **Backup automático todo dia**, guardado por alguns dias, sem ninguém precisar lembrar. Hoje o banco de produção **não tem nenhum backup automático**: só existe a cópia manual que a pessoa que constrói o app roda. Costuma vir também com mais capacidade de conexões, que o app já mostrou precisar | Perto de US$ 25 por mês |
| 2 | **Vercel, plano Pro** (onde o app roda) | O projeto está no plano **Hobby** (aparece escrito no painel). Pelas regras da Vercel, o Hobby é para **uso pessoal, não comercial**; a Academia é uma empresa. Vale confirmar nos termos da Vercel e, se for o caso, mudar. O Pro também guarda mais histórico dos registros de erro, o que ajuda a investigar problemas | Perto de US$ 20 por pessoa por mês |
| 3 | **Backup extra do banco com restauração por horário** (um complemento do Supabase) | Permite voltar o banco a **um minuto específico** (por exemplo, "dez minutos antes de alguém apagar a escala"). Só faz sentido depois do item 1, e só se o risco de perder um dia de trabalho incomodar | Custo à parte, confirmar |

## O que NÃO precisa pagar agora

- **Better Stack** (o verificador que avisa por e-mail quando o app cai): o plano grátis já cobre o que precisamos.
- **Sentry** (o alerta de erros dentro do app): o plano grátis dá o que o app gera hoje. Só vira necessário se o app passar do limite de erros por mês.
- **Domínio próprio** (por exemplo `app.suaacademia.com.br` em vez de `my-asa.vercel.app`): é bonito e dá confiança, mas não é segurança. Pode ficar para depois.

## A pergunta para decidir

1. A Academia aceita pagar uma mensalidade pequena para ter **backup automático do banco**? (Item 1.)
2. A Vercel permite o uso atual no plano Hobby, dado que a Academia é uma empresa? (Item 2: confirmar nos termos deles.)

Enquanto isso, existe um backup manual (`docs/backup-e-restauracao.md`) que cobre a falta do automático, mas ele **depende de uma pessoa lembrar de rodar**
toda semana.
