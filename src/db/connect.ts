import { AppDataSource } from "./data-source.js";
import { logger } from "../lib/logger.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type ConnectOptions = { retries?: number; delayMs?: number };

/**
 * Initialise the TypeORM DataSource, retrying on failure so a not-yet-ready or
 * briefly unavailable database doesn't kill the process on startup.
 */
export async function connectDb({
  retries = 10,
  delayMs = 3000,
}: ConnectOptions = {}): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
      }
      logger.info("connected to MariaDB");
      return;
    } catch (err) {
      if (attempt > retries) throw err;
      logger.warn(
        { attempt, retries, reason: (err as Error).message },
        "database not ready, retrying",
      );
      await sleep(delayMs);
    }
  }
}

export async function disconnectDb(): Promise<void> {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
}
