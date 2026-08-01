import express, { type Express } from "express";
import cors from "cors";
import { pinoHttp } from "pino-http";
import type { IncomingMessage, ServerResponse } from "http";
import router from "./routes";
import { logger } from "./lib/logger";
import { correlationIdMiddleware } from "./middlewares/correlation-id";

const app: Express = express();

app.use(correlationIdMiddleware);

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
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
