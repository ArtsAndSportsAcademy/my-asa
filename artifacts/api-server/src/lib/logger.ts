import pino from "pino";
import { LOG_DOMAIN } from "@workspace/shared";

const isProduction = process.env.NODE_ENV === "production";
// O bundler de testes remove o diretório temporário ao encerrar cada entrada.
// Sem transporte paralelo, pino ainda respeita LOG_LEVEL e não tenta carregar
// um worker depois que esse diretório já foi removido.
const usePrettyTransport = !isProduction && process.env.MYASA_TEST_RUNNER !== "1";

/**
 * Doc 12, "senha nunca em texto puro": erro de consulta do Drizzle traz a query com os parâmetros
 * (hash de senha, motivo de falta, token). O log guarda só o comando, nunca os valores.
 */
export function serializarErro(err: unknown): Record<string, unknown> {
  const base = pino.stdSerializers.err(err as Error) as Record<string, unknown> & { message?: string; stack?: string };
  const corta = (texto: unknown) => typeof texto === "string" ? texto.replace(/\nparams:[\s\S]*$/, "\nparams: [ocultos]") : texto;
  const { params: _params, cause, ...resto } = base;
  return {
    ...resto,
    message: corta(base.message),
    stack: corta(base.stack),
    ...(cause && typeof cause === "object" ? { cause: serializarErro(cause) } : {}),
  };
}

const CAMPOS_SECRETOS = ["password", "newPassword", "currentPassword", "passwordHash", "refreshToken", "accessToken", "token", "senhaProvisoria"];

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
    ...CAMPOS_SECRETOS,
    ...CAMPOS_SECRETOS.map((campo) => `*.${campo}`),
    ...CAMPOS_SECRETOS.map((campo) => `*.*.${campo}`),
  ],
  serializers: { err: serializarErro, error: serializarErro },
  ...(usePrettyTransport
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }
    : {}),
});

export function domainLogger(domain: (typeof LOG_DOMAIN)[keyof typeof LOG_DOMAIN]) {
  return logger.child({ domain });
}

export function requestLogger(
  domain: (typeof LOG_DOMAIN)[keyof typeof LOG_DOMAIN],
  requestId: string,
  correlationId: string,
) {
  return logger.child({ domain, requestId, correlationId });
}
