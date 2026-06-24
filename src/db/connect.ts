import mongoose from "mongoose";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

export async function connectDb(uri: string = env.MONGODB_URI): Promise<void> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
  logger.info("connected to MongoDB");
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
