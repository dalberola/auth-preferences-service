import "reflect-metadata";
import { DataSource } from "typeorm";
import { env } from "../config/env.js";
import { User } from "../models/user.js";
import { RefreshToken } from "../models/refreshToken.js";
import { VerificationToken } from "../models/verificationToken.js";

// Entities are listed explicitly — never glob paths, which break under ESM. They
// must live under `src/` (the tsconfig `include` scope) so tsx/Vitest apply the
// legacy `experimentalDecorators` transform TypeORM requires; see CLAUDE.md.
export const AppDataSource = new DataSource({
  type: "mysql",
  host: env.DB_HOST,
  port: env.DB_PORT,
  username: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  entities: [User, RefreshToken, VerificationToken],
  // Auto-sync schema outside production; production uses migrations (#4/#5).
  synchronize: env.NODE_ENV !== "production",
  // Tests get a clean schema on every run.
  dropSchema: env.NODE_ENV === "test",
  timezone: "Z",
  logging: false,
});
