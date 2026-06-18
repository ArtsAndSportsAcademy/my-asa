import pino from "pino";
import { LOG_DOMAIN } from "@workspace/shared";

const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
  ],
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
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
