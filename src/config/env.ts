import { config as loadEnv } from "dotenv";
import { z } from "zod";

// Precedence: real process.env (e.g. docker-compose) > .env.local > .env.
// dotenv never overrides an already-set key, so loading .env.local first
// gives it priority, and .env only fills in whatever is still missing.
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  // Express `trust proxy` setting. Controls which `X-Forwarded-*` headers are
  // honoured (client IP for rate limiting, `Secure` cookie decisions). Set to the
  // number of proxy hops in front of the app (`1` for a single LB/ingress), or
  // `false` when there is no proxy, `true` to trust all, or an Express preset /
  // comma-separated IP/subnet list.
  TRUST_PROXY: z
    .string()
    .default("1")
    .transform((v) => {
      if (v === "true") return true;
      if (v === "false") return false;
      if (/^\d+$/.test(v)) return Number(v);
      return v;
    }),

  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().default(""),
  DB_NAME: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(32),
  // Optional: the previous access secret, honored only for *verifying* tokens
  // during a rotation overlap. Set it to the old secret while rotating
  // `JWT_ACCESS_SECRET`, then remove it once all old tokens have expired
  // (≤ ACCESS_TTL). New tokens are always signed with `JWT_ACCESS_SECRET`.
  JWT_ACCESS_SECRET_PREVIOUS: z.string().min(32).optional(),
  ACCESS_TTL: z.string().default("15m"),
  REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(14),
  // Per-account login lockout: lock after this many consecutive failures, for
  // this many minutes. Complements the IP-based rate limiter (middleware/rateLimit).
  LOGIN_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  LOGIN_LOCK_MINUTES: z.coerce.number().int().positive().default(15),
  // How often the background reaper deletes expired tokens (MariaDB has no TTL).
  REAP_INTERVAL_MINUTES: z.coerce.number().int().positive().default(60),
  // How the refresh token reaches the client: httpOnly cookie (same-origin web,
  // default) or the JSON response body (cross-origin / browser-extension clients).
  REFRESH_TOKEN_TRANSPORT: z.enum(["cookie", "body"]).default("cookie"),

  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  // Implicit TLS on connect (SMTPS, typically port 465). Leave false for STARTTLS
  // (ports 587/25) and for the Mailpit dev server; nodemailer still upgrades via
  // STARTTLS when the server advertises it.
  SMTP_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().min(1),

  APP_URL: z.url(),
  CLIENT_URL: z.url(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast with a readable message instead of cryptic runtime errors later.
  console.error(
    "Invalid environment configuration:\n" +
      JSON.stringify(z.treeifyError(parsed.error), null, 2),
  );
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
