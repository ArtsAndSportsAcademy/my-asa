import app from "./app";
import { logger } from "./lib/logger";
import { startTaskReminderScheduler } from "./services/taskReminderService";
import { runProdBootstrap } from "./lib/bootstrap";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function start() {
  try {
    await runProdBootstrap();
  } catch (err) {
    logger.error({ err }, "Bootstrap failed; continuing to start server");
  }

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
    startTaskReminderScheduler();
  });
}

start();
