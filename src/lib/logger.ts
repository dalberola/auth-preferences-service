import { pino } from "pino";
import { env } from "../config/env.js";

// Redaction applied to every log line, including the request/response objects
// pino-http logs. Keeps credentials and tokens out of logs: the Authorization
// header (access JWT) and Cookie header (refresh token) on requests, the
// Set-Cookie response header (refresh token), and the verification `token` — which
// pino-http logs both in the raw URL and in the parsed `query`/`params` objects.
// The URL keeps everything except the token value.
export const redactOptions = {
  paths: [
    "req.headers.authorization",
    "req.headers.cookie",
    'res.headers["set-cookie"]',
    "req.url",
    "req.query.token",
    "req.params.token",
  ],
  censor: (value: unknown, path: string[]): unknown =>
    path[path.length - 1] === "url" && typeof value === "string"
      ? value.replace(/([?&]token=)[^&]*/gi, "$1[REDACTED]")
      : "[REDACTED]",
};

export const logger = pino({
  level: env.NODE_ENV === "test" ? "silent" : "info",
  redact: redactOptions,
});
