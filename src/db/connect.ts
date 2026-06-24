import mongoose from "mongoose";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type ConnectOptions = { retries?: number; delayMs?: number };

/**
 * Connect to MongoDB, retrying on failure so a not-yet-ready or briefly
 * unavailable database doesn't kill the process on startup. Each attempt uses a
 * short server-selection timeout so retries happen promptly.
 */
export async function connectDb(
  uri: string = env.MONGODB_URI,
  { retries = 10, delayMs = 3000 }: ConnectOptions = {},
): Promise<void> {
  mongoose.set("strictQuery", true);

  for (let attempt = 1; ; attempt++) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
      logger.info("connected to MongoDB");
      return;
    } catch (err) {
      if (attempt > retries) throw err;
      logger.warn(
        { attempt, retries, reason: (err as Error).message },
        "MongoDB not ready, retrying",
      );
      await sleep(delayMs);
    }
  }
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
