import { rateLimit } from "express-rate-limit";
import { env } from "../config/env.js";

const disabled = env.NODE_ENV === "test";

/** Strict limiter for credential / token endpoints. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => disabled,
  message: { error: { code: "RATE_LIMITED", message: "Too many requests" } },
});

/** Looser limiter for authenticated, non-credential routes. */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => disabled,
});
