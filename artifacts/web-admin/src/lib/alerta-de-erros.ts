import { erroEsperadoDoApp, limparErroParaEnvio } from "@workspace/shared";

/**
 * Alerta de erros do site (Sentry), 21/10/2026.
 *
 * Só liga no site publicado e só quando a variável VITE_SENTRY_DSN existe NO MOMENTO DO BUILD. Sem ela o código do Sentry nem entra
 * no pacote (o `if` é resolvido na compilação e o `import()` some). No `npm run dev`/amostra nunca liga.
 *
 * O que sai é decidido por `limparErroParaEnvio` (lib/shared): tipo do erro, frase técnica já sem e-mail/token/senha, trecho do
 * código e o endereço da tela sem query. Nunca cookie, cabeçalho, corpo, usuário, texto digitado, cliques nem nome de pessoa:
 * o Sentry 11 coleta tudo por padrão, então cada item é desligado aqui, e o filtro é a segunda trava. Erro que o app já espera e
 * mostra com uma frase (ApiError, rede fora do ar) não é enviado.
 */
export function iniciarAlertaDeErros(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn || import.meta.env.DEV) return;
  void import("@sentry/react").then((Sentry) => {
    Sentry.init({
      dsn,
      environment: "production",
      tracesSampleRate: 0,
      beforeBreadcrumb: () => null,
      beforeSend: (evento) => erroEsperadoDoApp(evento) ? null : limparErroParaEnvio(evento),
      dataCollection: {
        userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false,
        graphQL: { document: false, variables: false }, genAI: { inputs: false, outputs: false },
        databaseQueryData: false, queues: false, stackFrameVariables: false, frameContextLines: 0,
      },
    });
  }).catch(() => undefined);
}
