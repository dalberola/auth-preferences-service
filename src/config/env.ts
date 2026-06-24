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

  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().default(""),
  DB_NAME: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ACCESS_TTL: z.string().default("15m"),
  REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(14),

  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
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
