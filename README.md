# auth-preferences-service

[![CI](https://github.com/dalberola/auth-preferences-service/actions/workflows/ci.yml/badge.svg)](https://github.com/dalberola/auth-preferences-service/actions/workflows/ci.yml)

Standalone **registration + email-verification + user-preferences** API. No
frontend; intentionally decoupled from any consumer.

**Stack:** Node 24 · TypeScript 6 · Express 5 · MariaDB 11 / TypeORM 1.0 · JWT
(access + rotating refresh) · Nodemailer · Zod 4 · Vitest 4. ESM throughout. Dev
runs entirely in Docker.

## Quick start

```bash
cp .env.example .env.local    # then set JWT_ACCESS_SECRET / JWT_REFRESH_SECRET
docker compose up --build
```

> Generate secrets: `openssl rand -hex 32` (two different values, ≥ 32 chars).
> Config precedence: **`process.env` > `.env.local` > `.env`** (both files
> optional). Real secrets go in `.env.local` — git-ignored, never committed.

| Service | URL | Purpose |
| --- | --- | --- |
| API | http://localhost:4000 | the service (`GET /health`) |
| Mailpit | http://localhost:8025 | inbox that catches verification emails |
| MariaDB | localhost:3306 | data store |

The app hot-reloads via `tsx watch` on the bind-mounted source. Verification
emails are caught by Mailpit — open the UI and click the link (or use `/mailpit`).

## Endpoints

| Method | Path | Auth | Body / result |
| --- | --- | --- | --- |
| GET | `/health` | – | → `{ status: "ok" }` |
| POST | `/auth/register` | – | `{ email, password }` → 202 |
| GET | `/auth/verify?token=…` | – | → 302 redirect to `CLIENT_URL` |
| POST | `/auth/login` | – | `{ email, password }` → `{ accessToken }` + refresh cookie |
| POST | `/auth/refresh` | refresh cookie | → `{ accessToken }` (rotated) |
| POST | `/auth/logout` | refresh cookie | → 204 |
| POST | `/auth/resend-verification` | – | `{ email }` → 202 |
| GET | `/me/preferences` | Bearer | → `{ preferences }` |
| PUT | `/me/preferences` | Bearer | `{ theme?, locale?, settings? }` → `{ preferences }` |

Full reference with curl examples and error codes: [docs/api.md](docs/api.md).

## Documentation

| For | Read |
| --- | --- |
| **AI agents** | [CLAUDE.md](CLAUDE.md), then run the `/onboard` skill |
| Architecture & flows | [docs/architecture.md](docs/architecture.md) |
| HTTP API | [docs/api.md](docs/api.md) |
| Data model & indexes | [docs/data-model.md](docs/data-model.md) |
| Configuration | [docs/configuration.md](docs/configuration.md) |
| Dev workflow & troubleshooting | [docs/development.md](docs/development.md) |
| Security model | [docs/security.md](docs/security.md) |
| Issues, milestones, releases, CI | [docs/project-management.md](docs/project-management.md) |

## Scripts

```bash
npm run dev        # tsx watch (default container command)
npm run build      # tsc -> dist/
npm start          # node dist/server.js
npm run typecheck  # tsc --noEmit  (Vitest does NOT type-check — run this too)
npm run lint       # eslint
npm test           # vitest
```

**Verify any change** before calling it done: `npm run typecheck && npm run lint
&& npm test` (the `/verify` skill wraps this). Tests always run against a real
MariaDB — see [docs/development.md](docs/development.md).

## Claude Code skills

Project-scoped workflows live in [.claude/commands/](.claude/commands/):
`/onboard`, `/dev`, `/test`, `/lint`, `/verify`, `/logs`, `/db-shell`,
`/mailpit`, `/new-endpoint`, `/reset-db`. Index: [.claude/README.md](.claude/README.md).

## Layout

```
src/
  config/env.ts        zod-validated env (loads .env.local then .env)
  db/connect.ts        TypeORM DataSource initialize() with retry/backoff
  db/data-source.ts    TypeORM DataSource (explicit entity list, reflect-metadata)
  models/              User (preferences embedded) · VerificationToken · RefreshToken
  lib/                 password · tokens · jwt · mailer · logger · errors
  middleware/          requireAuth · errorHandler · rateLimit
  modules/auth/        register · verify · login · refresh · logout · resend
  modules/preferences/ GET/PUT /me/preferences
  app.ts · server.ts
test/                  end-to-end flow (Vitest)
docs/ · .claude/       documentation · Claude Code skills
```

## Future work

- Refresh token is an httpOnly cookie (same-origin web client). A cross-origin
  browser-extension consumer would move it to the response body + extension
  storage — switch the transport in `modules/auth/controller.ts`.
- Password reset reuses the `VerificationToken` model (add a `password_reset` type).
- No production Dockerfile yet — dev image only.
