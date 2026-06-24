import { createApp } from "./app.js";
import { connectDb } from "./db/connect.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";

async function main(): Promise<void> {
  await connectDb();
  const app = createApp();
  app.listen(env.PORT, () => {
    logger.info(`listening on http://localhost:${env.PORT}`);
  });
}

main().catch((err) => {
  logger.error({ err }, "failed to start server");
  process.exit(1);
});
