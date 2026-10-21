# Alerta de erros (Sentry): o que foi instalado e como ligar

## Em uma frase

O app agora sabe mandar para o Sentry um aviso "quebrou aqui" quando algo dá erro de verdade, mas **só se você puser a chave**. Sem a chave,
nada é enviado, em lugar nenhum, nem nos testes.

## O que sai e o que não sai

Sai: o tipo do erro, a frase técnica do erro, o trecho do código onde quebrou (arquivo e linha), qual tela ou rota, o sistema e o navegador.

Nunca sai: corpo da requisição, senha, token, cabeçalho de autorização, cookie, usuário, e-mail, o que a pessoa digitou, nome ou mensagem de
pessoa, parâmetros de consulta ao banco, variáveis do código, cliques e navegação. Duas travas, uma dentro da outra:

1. O Sentry é configurado com **cada coleta desligada** (a versão 11 vem com tudo ligado por padrão, então isso é item por item).
2. Por cima, um filtro (`lib/shared/src/limpar-erro-para-envio.ts`) monta o que sai só com a lista do que pode ficar. Da frase do erro apaga ainda e-mail,
   token, senha, CPF, telefone, códigos longos, os `params:` de uma consulta que falhou e o `Key (campo)=(valor)` do banco.

Testado em `artifacts/api-server/tests/alerta-de-erros.test.ts` (24 verificações, sem internet, com um erro de login e um de mensagem cheios de segredo).

Limite honesto: a frase que o **próprio app** escreve num erro de código (por exemplo, um `throw new Error("... " + nome)`) é enviada como está, depois de apagar
e-mail e códigos. Não existe regra que reconheça um nome de pessoa dentro de uma frase solta. Hoje, o que o servidor registra como erro vem do banco ou do
código, não de texto digitado. Por isso erros que o app **já espera** e mostra com frase à pessoa (recusa, validação, rede fora) **não são enviados**.

## O que cada lado faz

- **Servidor (`artifacts/api-server`)**: todo `log.error({ err }, ...)` e todo erro não tratado (que vira 500) vai para o Sentry. Na Vercel, a resposta só termina depois de o erro ser enviado (no máximo 2 segundos, e só quando houve erro), porque a função congela logo depois de responder.
- **Site (`artifacts/web-admin`)**: erros do navegador (tela quebrando, promessa sem tratamento). Nunca liga no `dev` nem na amostra.

## Como ligar (é com você: conta e chave)

O assistente não cria a conta nem escreve a chave em arquivo do repositório.

1. Abra **sentry.io** e crie a conta (plano **Developer**, o grátis). Segundo comparações, ele dá 5.000 erros por mês e 1 usuário; confira na página de preços.
2. Crie a organização e **dois projetos**: um da plataforma **Node.js / Express** (servidor) e um **React** (site). Se perguntar a região dos dados, escolha a que preferir (os dois lugares são fora do Brasil).
3. Em cada projeto, abra **Settings → Client Keys (DSN)** e copie o endereço que começa com `https://...@...ingest...sentry.io/...`. Esse endereço é a "chave" e **não vai para arquivo do repositório nem para a conversa**.
4. Na **Vercel**:
   - Projeto **my-asa** (servidor) → **Settings → Environment Variables** → nome `SENTRY_DSN`, valor: a chave do projeto do servidor, ambiente **Production** → Save.
   - Projeto **my-asa-web** (site) → mesma tela → nome `VITE_SENTRY_DSN`, valor: a chave do projeto do site, ambiente **Production** → Save. Esta é lida na hora da compilação, então a chave do site vai dentro do pacote (é assim com todo alerta de erro de navegador: a chave do site é pública por natureza; o que a protege é o filtro e o limite do plano).
5. **Refaça o envio** de cada projeto (Deployments → ⋯ → Redeploy). Variável nova só vale em envio novo. No site o redeploy precisa **compilar de novo**.
6. Conferir que ligou: no Sentry, em cada projeto, **Issues**. Para testar, quem constrói o app provoca um erro conhecido num ambiente de teste. Não provoque erro em produção.
7. Em **Alerts** do Sentry, deixe a regra padrão ("novo problema → e-mail"), com o e-mail da Administração.

Para desligar de novo: apague a variável na Vercel e refaça o envio. O app continua igual.

## O que muda na instalação do projeto

- Pacotes novos: `@sentry/node` (servidor) e `@sentry/react` (site). O empacotador do servidor (`build.mjs` e `tests/run-tests.mjs`) passou a **incluir** os pacotes `@opentelemetry/*` no pacote, porque o Sentry os importa e não havia cópia resolvível fora dele.
- O pacote do servidor (`dist/index.mjs`) tem hoje 6,6 MB; não medi o tamanho de antes.
