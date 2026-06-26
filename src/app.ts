import express, { type Express } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import { requireAuth } from "./middleware/requireAuth.js";
import { authRouter } from "./modules/auth/routes.js";
import { meRouter } from "./modules/preferences/routes.js";
import { accountRouter } from "./modules/account/routes.js";

export function createApp(): Express {
  const app = express();

  app.set("trust proxy", env.TRUST_PROXY);
  app.use(helmet());
  app.use(
    cors({
      origin: env.CLIENT_URL,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());
  app.use(pinoHttp({ logger }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/auth", authRouter);
  // Both /me routers share one guard. Applying it here (rather than a `.use`
  // inside each router) keeps it running exactly once even when a request falls
  // through meRouter — which only owns /preferences — to accountRouter's DELETE.
  app.use("/me", apiLimiter, requireAuth, meRouter, accountRouter);

  app.use(errorHandler);
  return app;
}
