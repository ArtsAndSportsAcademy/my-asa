import { AsyncLocalStorage } from "node:async_hooks";
import type { NextFunction, Request, Response } from "express";
import * as Sentry from "@sentry/node";
import { erroEsperadoDoApp, limparErroParaEnvio } from "@workspace/shared";

/**
 * Alerta de erros do servidor (Sentry), 21/10/2026.
 *
 * Só liga quando existe a variável de ambiente SENTRY_DSN. Sem ela, nada é iniciado e nada sai do servidor. Os testes nunca enviam:
 * com MYASA_TEST_RUNNER=1 só liga se o teste passar um transporte falso.
 *
 * O que sai é decidido por `limparErroParaEnvio` (lib/shared): tipo do erro, frase técnica já sem e-mail/token/senha/parâmetros de
 * consulta, trecho do código e endereço sem query. Nunca cabeçalho, cookie, corpo da requisição, usuário, nome ou mensagem de pessoa
 * (`dataCollection` com tudo desligado, migalhas de pão descartadas e o filtro por cima de tudo, como segunda trava).
 */
let ativo = false;
export const alertaDeErrosAtivo = () => ativo;

type OpcoesDeTeste = { dsn?: string; transport?: NonNullable<Parameters<typeof Sentry.init>[0]>["transport"] };

export function iniciarAlertaDeErros(opcoes: OpcoesDeTeste = {}): boolean {
  if (ativo) return true;
  const dsn = opcoes.dsn ?? process.env.SENTRY_DSN;
  if (!dsn) return false;
  if (process.env.MYASA_TEST_RUNNER === "1" && !opcoes.transport) return false;
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "production",
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    // No Sentry 11 os padrões COLETAM tudo (usuário, cookies, cabeçalhos, corpo, variáveis locais, parâmetros de consulta): desliga item por item.
    dataCollection: {
      userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false,
      graphQL: { document: false, variables: false }, genAI: { inputs: false, outputs: false },
      databaseQueryData: false, queues: false, stackFrameVariables: false, frameContextLines: 0,
    },
    // Só erros: sem medir desempenho, sem gravar tela, sem registros de texto.
    tracesSampleRate: 0,
    beforeBreadcrumb: () => null,
    // Não mexe no que o Node já faz com erro não tratado (derrubar o processo): o alerta só observa, não muda o comportamento.
    integrations: (padrao) => padrao.filter((integracao) => !["OnUncaughtException", "OnUnhandledRejection"].includes(integracao.name)),
    beforeSend: (evento) => erroEsperadoDoApp(evento) ? null : limparErroParaEnvio(evento),
    ...(opcoes.transport ? { transport: opcoes.transport } : {}),
  });
  ativo = true;
  return true;
}

/** Desliga (só para os testes voltarem ao estado inicial). */
export async function desligarAlertaDeErros() {
  if (!ativo) return;
  await Sentry.close(2000);
  ativo = false;
}

/** Guarda, por requisição, se um erro foi capturado — para segurar a resposta até o envio terminar (ver abaixo). */
const porRequisicao = new AsyncLocalStorage<{ capturou: boolean }>();

/** Manda o erro para o alerta. Nunca lança: o alerta não pode ser a causa de um erro novo. */
export function capturarErro(erro: unknown, origem?: string): void {
  if (!ativo) return;
  try {
    const estado = porRequisicao.getStore();
    if (estado) estado.capturou = true;
    Sentry.withScope((escopo) => {
      if (origem) escopo.setTag("mechanism", origem);
      Sentry.captureException(erro instanceof Error ? erro : new Error(typeof erro === "string" ? erro : "erro sem detalhe"));
    });
  } catch { /* ignora: ver acima */ }
}

/**
 * Na Vercel a função congela logo depois da resposta, e um envio ainda pendente se perde. Quando um erro foi capturado durante a
 * requisição, a resposta só termina depois de `Sentry.flush` (no máximo 2 s). Requisição sem erro não espera nada.
 */
export function enviarErrosAntesDeResponder(_req: Request, res: Response, next: NextFunction) {
  if (!ativo) { next(); return; }
  const estado = { capturou: false };
  const terminar = res.end.bind(res) as (...args: unknown[]) => Response;
  (res as unknown as { end: (...args: unknown[]) => Response }).end = (...args: unknown[]) => {
    if (!estado.capturou) return terminar(...args);
    estado.capturou = false;
    void Sentry.flush(2000).catch(() => false).finally(() => terminar(...args));
    return res;
  };
  porRequisicao.run(estado, next);
}

/** Erro que chegou ao fim das rotas sem ninguém tratar (vira 500): vai para o alerta e segue o caminho de sempre. */
export function capturarErroNaoTratado(err: unknown, _req: Request, _res: Response, next: NextFunction) {
  const status = Number((err as { status?: number; statusCode?: number } | null)?.status ?? (err as { statusCode?: number } | null)?.statusCode ?? 500);
  if (status >= 500) capturarErro(err, "express");
  next(err);
}

export const enviarPendentes = (ms = 2000) => ativo ? Sentry.flush(ms) : Promise.resolve(true);
