import "reflect-metadata";
import type { Server } from "node:http";
import { createApp } from "./app.js";
import { connectDb, disconnectDb } from "./db/connect.js";
import { startTokenReaper } from "./db/reaper.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";

// Give in-flight requests time to finish before forcing exit. Keep this below the
// container's stop grace period (Docker's default is 10s) so we exit cleanly first.
const SHUTDOWN_TIMEOUT_MS = 8000;

async function main(): Promise<void> {
  await connectDb();
  const reaper = startTokenReaper(env.REAP_INTERVAL_MINUTES * 60_000);
  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`listening on http://localhost:${env.PORT}`);
  });

  installGracefulShutdown(server, reaper);
}

/**
 * Stop cleanly on the signals a container/orchestrator sends: stop the reaper,
 * close the HTTP server (refuse new connections, drain in-flight requests), then
 * close the DB pool. A bounded timer force-exits if a connection hangs, and a
 * guard makes repeated signals a no-op.
 */
function installGracefulShutdown(
  server: Server,
  reaper: { stop: () => void },
): void {
  let shuttingDown = false;

  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "shutting down");

    const forced = setTimeout(() => {
      logger.error("graceful shutdown timed out; forcing exit");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forced.unref();

    reaper.stop();
    server.close((err) => {
      void (async () => {
        if (err) logger.error({ err }, "error closing HTTP server");
        try {
          await disconnectDb();
        } catch (dbErr) {
          logger.error({ err: dbErr }, "error closing database");
        }
        clearTimeout(forced);
        logger.info("shutdown complete");
        process.exit(err ? 1 : 0);
      })();
    });
  };

  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.on(signal, () => shutdown(signal));
  }
}

main().catch((err) => {
  logger.error({ err }, "failed to start server");
  process.exit(1);
});
