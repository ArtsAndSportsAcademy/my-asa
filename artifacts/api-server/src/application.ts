import express, { type Express } from "express";
import cors from "cors";
import { pinoHttp } from "pino-http";
import type { IncomingMessage, ServerResponse } from "http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";
import { correlationIdMiddleware } from "./middlewares/correlation-id.js";
import { capturarErroNaoTratado, enviarErrosAntesDeResponder, iniciarAlertaDeErros } from "./lib/alerta-de-erros.js";

// Só liga se existir SENTRY_DSN no ambiente; sem a chave, não faz nada e nada sai do servidor.
iniciarAlertaDeErros();

const app: Express = express();

app.use(correlationIdMiddleware);
// Na Vercel, segura a resposta até o erro capturado ser enviado (só quando houve erro nesta requisição).
app.use(enviarErrosAntesDeResponder);

app.use(
  pinoHttp({
    logger,
    genReqId: (req) => (req as express.Request).requestId,
    serializers: {
      req(req: IncomingMessage & { id?: unknown; raw?: express.Request }) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
          correlationId: (req.raw as express.Request)?.correlationId,
        };
      },
      res(res: ServerResponse) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ exposedHeaders: ["X-MyASA-Undo"] }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Endereço da API que não existe: a resposta é JSON, não a página HTML "Cannot GET" do Express (que o app tentaria ler como dados).
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "NOT_FOUND", message: "Esse endereço da API não existe." });
});

// Erro que ninguém tratou (vira 500): vai para o alerta de erros e segue o caminho de sempre.
app.use(capturarErroNaoTratado);

// Corpo enviado com JSON quebrado: recusa em JSON, com frase, em vez de uma página HTML de erro.
app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if ((err as { type?: string } | null)?.type === "entity.parse.failed") {
    res.status(400).json({ error: "JSON_INVALIDO", message: "Não consegui ler o que foi enviado. Nada foi alterado." });
    return;
  }
  // Arquivo maior que o limite (foto de perfil, PDF): o Express respondia uma página HTML "PayloadTooLargeError".
  if ((err as { type?: string } | null)?.type === "entity.too.large") {
    res.status(413).json({ error: "ARQUIVO_GRANDE_DEMAIS", message: "Esse arquivo é maior do que o app aceita. Escolha um menor. Nada foi alterado." });
    return;
  }
  next(err);
});

export default app;
