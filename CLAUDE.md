# CLAUDE.md — agent context for auth-preferences-service

Always-loaded context for AI agents working in this repo. For a guided, first-time
walkthrough run the **`/onboard`** skill. Human-facing entry point is [README.md](README.md);
deep docs live in [docs/](docs/).

## What this is

A standalone backend service: **registration → email verification → per-user
preferences**. No frontend. It is intentionally decoupled from any consumer (it
was split out of the Tabliss project but does not depend on it).

## Stack (all latest majors as of creation)

Node 24 · TypeScript 6 · **Express 5** · MongoDB 8 / **Mongoose 9** · Zod 4 ·
argon2 · jsonwebtoken 9 · Nodemailer 9 · Pino · **Vitest 4** · ESLint 10 +
typescript-eslint 8. ESM throughout (`"type": "module"`, `NodeNext` resolution —
**relative imports use `.js` extensions**). Dev runs entirely in Docker.

## Run it

```bash
cp .env.example .env.local      # set the two JWT secrets (openssl rand -hex 32)
docker compose up --build       # app :4000 · mailpit :8025 · mongo :27017
```

The `app` container runs `tsx watch` over a bind mount, so host edits hot-reload.
Verification emails are caught by **Mailpit** (http://localhost:8025) — no real
SMTP in dev.

## Verify EVERY change before calling it done

```bash
# host (macOS): in-memory Mongo is downloaded automatically
npm run typecheck && npm run lint && npm test

# inside a container (arm64 can't fetch the in-memory binary — see gotchas):
docker run --rm --network auth-preferences-service_default \
  -e MONGODB_TEST_URI=mongodb://mongo:27017/test \
  -v "$PWD":/app -w /app node:24-slim \
  sh -c "npm run typecheck && npm run lint && npm test"
```

Vitest uses esbuild and does **not** type-check — always run `typecheck`
separately. The `/verify` skill wraps this.

## Layout

```
src/
  config/env.ts        zod-validated env; loads .env.local then .env; exits on invalid config
  db/connect.ts        mongoose connection WITH retry/backoff
  models/              User (preferences embedded) · VerificationToken · RefreshToken
  lib/                 password(argon2) · tokens(crypto) · jwt · mailer · logger · errors
  middleware/          requireAuth · errorHandler · rateLimit
  modules/auth/        register · verify · login · refresh · logout · resend
  modules/preferences/ GET/PUT /me/preferences
  app.ts · server.ts
test/                  end-to-end flow (Vitest + real/in-memory Mongo)
docs/                  architecture · api · configuration · development · security · data-model
.claude/               skills (commands/) + this config's index
```

## Conventions

- **New HTTP feature** = a module folder with `validators.ts` (zod), `service.ts`
  (business logic, throws `AppError`), `controller.ts` (Express handlers, parse →
  call service → respond), `routes.ts` (Router); mount it in `app.ts`. Use the
  `/new-endpoint` skill. Keep controllers thin; never put Mongoose calls in them.
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

- **Docker VM disk fills up** → Mongo dies with `exit 100` /
  `No space left on device` creating `/data/db/journal`, and the app then fails
  with `ENOTFOUND mongo`. Fix: `docker builder prune -af` (build cache is safe to
  drop). Diagnose with the `/logs` skill.
- **`mongodb-memory-server` has no aarch64/debian12 binary** — it 403s in arm64
  Linux containers. That's why the test harness uses `MONGODB_TEST_URI` against a
  real Mongo when set, and only falls back to the in-memory server on hosts that
  can fetch the binary (e.g. macOS arm64).
- **`tsx watch` keeps the container "Up" even after the Node process exits**
  (e.g. a failed startup). A green `docker compose ps` does not prove the server
  is listening — check logs / `curl /health`. After fixing a startup failure the
  app may need `docker compose restart app`.
- **`.env.local` precedence**: `process.env` > `.env.local` > `.env`. dotenv never
  overrides already-set keys, so docker-compose-injected vars win.

## Project tracking (GitHub is the source of truth)

Work is tracked on GitHub — **issues**, **milestones**, **tags/releases**, and
**Actions** — not just in these docs. Agents are authorized to operate these tools
and must keep them updated. See [docs/project-management.md](docs/project-management.md).

- Planned/known work → **issues** (labelled, assigned to a **milestone** = version).
- Discovered scope → open an issue, don't expand silently. Close issues from
  commits/PRs (`Closes #n`).
- **CI must be green** before merging to `main` (`.github/workflows/ci.yml`:
  typecheck → lint → test against a Mongo service). Check with `/ci`.
- Releases via `/release` (version + changelog + tag + GitHub release + close
  milestone). Keep [CHANGELOG.md](CHANGELOG.md) in step.
- Skills: `/triage` (issues/milestones), `/ci` (Actions), `/release`.

## Status

Repo: **github.com/dalberola/auth-preferences-service** (private). `main` is the
default branch and is pushed. Baseline tagged `v0.1.0`. The refresh cookie suits a
same-origin web client; a cross-origin browser-extension consumer would move the
refresh token to the response body + extension storage (tracked as an issue).
