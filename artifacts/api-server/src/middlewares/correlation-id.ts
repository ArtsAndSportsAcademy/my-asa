import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { CORRELATION_ID_HEADER, REQUEST_ID_HEADER } from "@workspace/shared";

declare global {
  namespace Express {
    interface Request {
      correlationId: string;
      requestId: string;
    }
  }
}

export function correlationIdMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const incomingCorrelationId = req.headers[CORRELATION_ID_HEADER];
  const incomingRequestId = req.headers[REQUEST_ID_HEADER];

  req.correlationId =
    typeof incomingCorrelationId === "string" && incomingCorrelationId.length > 0
      ? incomingCorrelationId
      : randomUUID();

  req.requestId =
    typeof incomingRequestId === "string" && incomingRequestId.length > 0
      ? incomingRequestId
      : randomUUID();

  next();
}
