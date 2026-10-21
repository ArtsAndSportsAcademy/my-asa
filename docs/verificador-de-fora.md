# Verificador de "está no ar?" — qual usar e como ligar

## O que ele faz, em uma frase

Um serviço de fora abre um endereço do app de poucos em poucos minutos, como uma pessoa abriria no navegador. Se o endereço der erro (ou
nem abrir), o serviço manda um e-mail. Ele precisa ser **de fora** porque, se o app caiu, o próprio app não consegue avisar ninguém.

O endereço que ele vai olhar é:

```
https://my-asa.vercel.app/api/saude
```

- Responde **200** quando o app e o banco funcionam e o relógio do sistema (o ciclo por minuto) está em dia.
- Responde **503** quando o banco não responde, ou quando o relógio passou de 3 minutos parado. Como qualquer verificador entende "503 = problema", **não é preciso configurar nada especial**.
- **Não mostra nada de pessoas.** Só: `status` (ok / relogio_parado / banco_fora), `banco` (ok / falha) e há quantos segundos o ciclo rodou. Um teste automático confere que nenhum nome, id ou casa aparece ali.
- Cada vez que o verificador olha e o relógio está parado, o app aproveita para avisar a Administração no sino (uma vez por parada). É assim que a parada do relógio vira aviso sem depender do próprio relógio.

## Comparação das opções gratuitas

Os números abaixo vêm de páginas de comparação na internet (de empresas concorrentes entre si, então podem exagerar). **Confira na página de preços de cada um antes de criar a conta**; as regras gratuitas mudam.

| | UptimeRobot | Better Stack | Vercel (o próprio) |
|---|---|---|---|
| Custo | Grátis | Grátis | — |
| Olha o endereço a cada | 5 minutos | 3 minutos | — |
| Quantos endereços no grátis | 50 | 10 (só precisamos de 1) | — |
| Aviso por e-mail no grátis | Sim | Sim (celular/ligação variam conforme a conta) | — |
| Uso por empresa no plano grátis | **Relatos dizem que o plano grátis é só para uso não comercial desde 2024.** A Academia é uma empresa. | Permitido, segundo as comparações | — |
| Serve para este caso? | Provavelmente não, pelo uso comercial | **Sim** | **Não**: o Vercel não oferece, no plano grátis que eu conheça, um verificador que olhe um endereço e mande e-mail quando falha. (Ele mostra erros nos Logs, mas só se alguém for olhar.) |

**Recomendação: Better Stack.** É grátis, olha a cada 3 minutos (combina com o limite de 3 minutos do relógio), não tem a restrição de uso comercial, e o plano grátis cobre o que precisamos (um endereço, e-mail). O UptimeRobot só faria sentido se confirmarem que o uso comercial está liberado no grátis.

## Passo a passo (Better Stack) — sem precisar saber o que é um "monitor"

"Monitor" aqui é só o nome que o serviço dá a "um endereço que eu fico olhando". Você vai criar um.

Este passo a passo cria **conta** e coloca o **seu e-mail**: é com você (quem constrói o app), não com o assistente.

1. Abra **betterstack.com** e clique em **Get started** / **Sign up**. Crie a conta com o e-mail que **deve receber os alertas** (de preferência um que alguém da Administração também leia).
2. Confirme o e-mail que eles mandam.
3. Dentro do painel, escolha a parte chamada **Uptime** (o nome pode aparecer como "Better Uptime"). Se ele perguntar se quer um teste dos planos pagos, escolha **continuar no plano grátis** (Free).
4. Clique em **Create monitor** (criar monitor).
5. Preencha:
   - **URL to monitor** (endereço): `https://my-asa.vercel.app/api/saude`
   - **Alert us when** (avise quando): deixe a opção **"URL returns HTTP status other than 2xx"** (o endereço responde com algo diferente de 200). Qualquer outra variação que diga "status HTTP diferente de 2xx" também serve.
   - **Check frequency** (de quanto em quanto tempo): **3 minutos**, que é o menor do plano grátis.
   - **How to alert** (como avisar): marque **E-mail**. Se pedirem "ligação" ou "SMS" e isso gastar crédito, deixe desmarcado.
   - Nome do monitor: `My ASA - saúde`.
6. Clique em **Create monitor**.
7. **Teste o aviso**: no monitor criado, procure **Send test alert** (mandar alerta de teste) ou pause e reative. Confira que o e-mail chegou. Se não chegou, olhe a caixa de spam e marque "não é spam".
8. Opcional: crie um **segundo** monitor, com o endereço do site `https://my-asa-web.vercel.app`, para saber se o site (a parte que as pessoas abrem) também caiu. O primeiro cobre a API e o banco.

Pronto. Quando o app cair ou o relógio parar, o e-mail chega. O que fazer quando ele chegar está em `docs/quando-o-app-cai.md`.

## Antes de confiar: confira em produção depois de promover

Depois de promover a migração 0076 e a API nova (ordem em `docs/handoff-2026-10-21-etapa-1.md`), abra `https://my-asa.vercel.app/api/saude` no navegador. Espere ver `"situacao":"em_dia"` e um número pequeno de segundos. Se aparecer `"situacao":"sem_registro"` por mais de 2 minutos, o agendador do Supabase (`myasa-ciclo`) não está chamando a API: siga o passo 3 do guia de quando o app cai. (Enquanto o ciclo nunca tiver rodado depois da promoção, o endereço responde 200 de propósito, para não dar alarme falso no minuto da promoção; por isso essa conferência manual é importante.)
