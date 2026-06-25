import "reflect-metadata";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DataSource } from "typeorm";
import { env } from "../config/env.js";
import { User } from "../models/user.js";
import { RefreshToken } from "../models/refreshToken.js";
import { VerificationToken } from "../models/verificationToken.js";

// Migrations are resolved relative to this file so the glob works in both worlds:
// under tsx (dev/test) it matches the TypeScript sources in `src/migrations`, and
// in the compiled image it matches `dist/migrations`. Unlike entities, migrations
// are plain classes with no decorators, so the "must live under src for the
// experimentalDecorators transform" rule (see CLAUDE.md) does not apply to them.
const migrationsGlob = join(
  dirname(fileURLToPath(import.meta.url)),
  "../migrations/*.{js,ts}",
);

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
  // Tests build their schema from entities via `synchronize`, never migrations,
  // so skip the glob there: Vitest workers import the matched files through
  // Node's loader, which cannot resolve the `.ts` sources (no tsx loader). Dev
  // (tsx) and the compiled image (dist `.js`) load it fine.
  migrations: env.NODE_ENV === "test" ? [] : [migrationsGlob],
  // Dev/test auto-sync the schema from entities; production owns its schema
  // through migrations, run automatically on startup (`migrationsRun`).
  synchronize: env.NODE_ENV !== "production",
  migrationsRun: env.NODE_ENV === "production",
  // Tests get a clean schema on every run.
  dropSchema: env.NODE_ENV === "test",
  timezone: "Z",
  logging: false,
});
