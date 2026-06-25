# CLAUDE.md — agent context for auth-preferences-service

Always-loaded context for AI agents working in this repo. For a guided, first-time
walkthrough run the **`/onboard`** skill. Human-facing entry point is [README.md](README.md);
deep docs live in [docs/](docs/).

## What this is

A standalone backend service: **registration → email verification → per-user
preferences**. No frontend. It is intentionally decoupled from any consumer (it
was split out of the Tabliss project but does not depend on it).

## Stack (all latest majors as of creation)

Node 24 · TypeScript 6 · **Express 5** · **MariaDB 11 / TypeORM 1.0** (mysql2) ·
Zod 4 · argon2 · jsonwebtoken 9 · Nodemailer 9 · Pino · **Vitest 4** · ESLint 10 +
typescript-eslint 8. ESM throughout (`"type": "module"`, `NodeNext` resolution —
**relative imports use `.js` extensions**). TypeORM needs legacy decorators:
`experimentalDecorators` + `emitDecoratorMetadata` are on, and entrypoints import
`reflect-metadata`. Dev runs entirely in Docker.

## Run it

```bash
cp .env.example .env.local      # set JWT_ACCESS_SECRET (openssl rand -hex 32)
docker compose up --build       # app :4000 · mailpit :8025 · mariadb :3306
```

The `app` container runs `tsx watch` over a bind mount, so host edits hot-reload.
Verification emails are caught by **Mailpit** (http://localhost:8025) — no real
SMTP in dev.

## Verify EVERY change before calling it done

```bash
# Tests need a reachable MariaDB. test/setup.ts defaults DB_* to the compose
# stack (127.0.0.1:3306, root/root, db auth_preferences_test), so with /dev up:
npm run typecheck && npm run lint && npm test
```

The test harness creates the `*_test` database if absent and drops its schema each
run. If your MariaDB differs, `export DB_HOST=… DB_PORT=…` first so the overrides
reach `npm test` (a `VAR=… cmd1 && cmd2` prefix only applies to `cmd1`). CI
overrides `DB_*` for its MariaDB service container. Vitest uses esbuild and does
**not** type-check — always run `typecheck` separately. The `/verify` skill wraps this.

## Layout

```
src/
  config/env.ts        zod-validated env; loads .env.local then .env; exits on invalid config
  db/data-source.ts    TypeORM DataSource (explicit entity list, NO globs); imports reflect-metadata
  db/connect.ts        DataSource.initialize() WITH retry/backoff
  db/reaper.ts         interval reaper deleting expired tokens (replaces Mongo TTL)
  models/              User (preferences JSON) · VerificationToken · RefreshToken — TypeORM entities
  lib/                 password(argon2) · tokens(crypto) · jwt · mailer · logger · errors
  middleware/          requireAuth · errorHandler · rateLimit
  modules/auth/        register · verify · login · refresh · logout · resend
  modules/preferences/ GET/PUT /me/preferences
  app.ts · server.ts
test/                  end-to-end flow (Vitest + real MariaDB)
docs/                  architecture · api · configuration · development · security · data-model
.claude/               skills (commands/) + this config's index
```

## Conventions

- **New HTTP feature** = a module folder with `validators.ts` (zod), `service.ts`
  (business logic, throws `AppError`), `controller.ts` (Express handlers, parse →
  call service → respond), `routes.ts` (Router); mount it in `app.ts`. Use the
  `/new-endpoint` skill. Keep controllers thin; data access (TypeORM repositories)
  lives only in `service.ts`, never in controllers.
- **Errors**: throw `AppError` (or `badRequest`/`unauthorized`/`forbidden` from
  `lib/errors.ts`). Express 5 forwards thrown/rejected errors to `errorHandler`,
  which maps `AppError` and `ZodError` to JSON — don't write try/catch in routes.
- **Secrets** never logged, never committed. Real secrets go in `.env.local`
  (git-ignored by the repo's own `.gitignore`, not just a global one).
- **Tokens** are stored **hashed** (sha256); the raw value only ever leaves in an
  email link or an API response. Never persist a raw token.
- **Auth model**: short-lived access JWT in the response body; refresh token in an
  httpOnly cookie scoped to `/auth`, rotated every refresh with family-based reuse
  detection. See [docs/security.md](docs/security.md).

## Gotchas (learned the hard way)

- **TypeORM decorators only transform inside the tsconfig `include` scope.** tsx
  and Vitest both use esbuild (via `get-tsconfig`), which applies
  `experimentalDecorators` **only to files matched by `include` (`["src"]`)**.
  An entity placed outside `src/` gets the standard-ES-decorator transform and
  TypeORM crashes (`__decorateElement` → `Cannot read properties of undefined
  (reading 'constructor')`). **Keep all entities under `src/`.**
- **Stale `node_modules` in the anonymous volume.** The `app` service mounts an
  anonymous volume at `/app/node_modules` (to preserve the container-built native
  argon2). After changing dependencies, that volume **shadows** the freshly built
  image's `node_modules` → `ERR_MODULE_NOT_FOUND`. Fix:
  `docker compose up --build --renew-anon-volumes` (or `down` then `up --build`).
- **Docker VM disk fills up** → the DB container can die / the app fails to reach
  it. Fix: `docker builder prune -af` (build cache is safe to drop). Diagnose with
  the `/logs` skill.
- **`tsx watch` keeps the container "Up" even after the Node process exits**
  (e.g. a failed startup). A green `docker compose ps` does not prove the server
  is listening — check logs / `curl /health`. After fixing a startup failure the
  app may need `docker compose restart app`.
- **`.env.local` precedence**: `process.env` > `.env.local` > `.env`. dotenv never
  overrides already-set keys, so docker-compose-injected vars win. Note `docker run
  --env-file .env.local` is **not** dotenv: it keeps literal quotes (a quoted
  `MAIL_FROM` breaks the SMTP envelope) and will happily override the image's baked
  `NODE_ENV=production` with the file's `NODE_ENV=development`. Force overrides with
  explicit `-e` when smoke-testing the prod image.
- **Schema: `synchronize` in dev/test, migrations in prod.** `db/data-source.ts`
  sets `synchronize: NODE_ENV !== "production"` and `migrationsRun: NODE_ENV ===
  "production"`, so the prod image creates/updates its schema from
  `dist/migrations/*.js` on startup. After changing an entity, run `npm run
  migration:generate -- src/migrations/<Name>` (TypeORM CLI via `tsx`) and commit
  it. The `migrations` glob is **skipped under `NODE_ENV=test`** — Vitest workers
  import glob matches through Node's loader, which can't resolve the `.ts` sources
  (`Unknown file extension ".ts"`); tests build schema from entities anyway.
  Generate against a DB with prior migrations applied (not the `synchronize`-mutated
  dev DB), and **review the diff** — TypeORM perpetually re-suggests no-op `CHANGE`
  statements for nullable `datetime`/`varchar` columns on MariaDB (their `down` even
  adds a bogus `DEFAULT 'NULL'`); keep only the intended changes.

## Project tracking (GitHub is the source of truth)

Work is tracked on GitHub — **issues**, **milestones**, **tags/releases**, and
**Actions** — not just in these docs. Agents are authorized to operate these tools
and must keep them updated. See [docs/project-management.md](docs/project-management.md).

- Planned/known work → **issues** (labelled, assigned to a **milestone** = version).
- Discovered scope → open an issue, don't expand silently. Close issues from
  commits/PRs (`Closes #n`).
- **Lanes** (one `lane:*` label per issue): `backlog` → `ready` → `in-progress` →
  `needs-verification` → done; plus `blocked` and `needs-triage`. Binding processes
  (see [docs/project-management.md](docs/project-management.md)):
  - **Found something uncertain while coding** → open an issue labelled
    `uncertainty` + `lane:needs-verification`; it **stays open until verified** —
    don't rely on the assumption until it's closed with evidence.
  - **Planning an execution** → give it a milestone and/or issue first, then
    `lane:ready` → `lane:in-progress`.
  - **Deferring an idea** → issue in `lane:backlog` (no milestone). Docs/README link
    to the backlog rather than duplicating it.
- **CI must be green** before merging to `main` (`.github/workflows/ci.yml`:
  typecheck → lint → test against a MariaDB service). Check with `/ci`.
- Releases via `/release` (version + changelog + tag + GitHub release + close
  milestone). Keep [CHANGELOG.md](CHANGELOG.md) in step.
- Skills: `/triage` (issues/milestones), `/ci` (Actions), `/release`.

## Status

Repo: **github.com/dalberola/auth-preferences-service** (public). `main` is the
default branch and is pushed. Baseline tagged `v0.1.0`; current release **v1.3.0**
(production image, TypeORM migrations, trust-proxy/SMTP-TLS config, login lockout,
deployment runbook, graceful shutdown, log redaction, login-timing hardening,
zero-downtime access-secret rotation).

**Deployed to production** (milestone v1.4.0, [#43](https://github.com/dalberola/auth-preferences-service/issues/43)
done): live at **https://auth.diginaut.es** on **Infomaniak shared hosting**
(managed Node.js site via the Node.js Builder — clones the public repo, builds on
boosted infra; **not** the Docker image, **not** SSH file-deploy). Consumer is the
tabliss site at `https://diginaut.es`. Runtime env is a host-side `.env` in the
execution folder; build is `npm ci && npm run build`; migrations run on boot. The
full register→verify→login→preferences flow is verified live, and the refresh
**cookie** works cross-subdomain (same-site `SameSite=Lax`, `Secure`). See
[docs/deployment.md](docs/deployment.md#live-production-infomaniak-shared-hosting-authdiginautes)
for the Manager config and the Infomaniak-specific gotchas (the
`npm run install` ≠ `npm install` trap, dotenv password-quoting, managed-DB remote
access). Next in v1.4.0: reCAPTCHA v3 ([#36](https://github.com/dalberola/auth-preferences-service/issues/36),
`lane:ready`).
