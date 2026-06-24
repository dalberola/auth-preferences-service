# auth-preferences-service

Standalone registration + email-verification + user-preferences API.

**Stack:** Node 24 · TypeScript · Express 5 · MongoDB (Mongoose 9) · JWT (access + rotating refresh) · Nodemailer · Zod · Vitest. Dev runs entirely in Docker.

## Quick start (Docker)

```bash
cp .env.example .env.local    # then set JWT_ACCESS_SECRET / JWT_REFRESH_SECRET
docker compose up --build
```

Config is loaded with precedence **`process.env` > `.env.local` > `.env`**, both
files optional. Put real secrets in `.env.local` (git-ignored, never committed);
`.env` is for shared, non-secret defaults if you want them.

Services:

| Service | URL | Purpose |
| --- | --- | --- |
| API | http://localhost:4000 | the service (`GET /health`) |
| Mailpit | http://localhost:8025 | inbox that catches verification emails |
| MongoDB | mongodb://localhost:27017 | data store |

The app container hot-reloads via `tsx watch` on the bind-mounted source.
Verification emails are caught by Mailpit — open the web UI and click the link.

> Generate secrets: `openssl rand -hex 32` (two different values, ≥32 chars each).

## Endpoints

| Method | Path | Auth | Body |
| --- | --- | --- | --- |
| POST | `/auth/register` | – | `{ email, password }` → 202 |
| GET | `/auth/verify?token=…` | – | → 302 redirect to `CLIENT_URL` |
| POST | `/auth/login` | – | `{ email, password }` → `{ accessToken }` + refresh cookie |
| POST | `/auth/refresh` | refresh cookie | → `{ accessToken }` (rotated) |
| POST | `/auth/logout` | refresh cookie | → 204 |
| POST | `/auth/resend-verification` | – | `{ email }` → 202 |
| GET | `/me/preferences` | Bearer access token | → `{ preferences }` |
| PUT | `/me/preferences` | Bearer access token | `{ theme?, locale?, settings? }` → `{ preferences }` |

Access token: `Authorization: Bearer <token>` (15 min). Refresh token: httpOnly
cookie scoped to `/auth`, rotated on every `/auth/refresh` with reuse detection.

## Security

argon2id passwords · single-use SHA-256-hashed tokens with TTL auto-expiry ·
refresh-token rotation + family revocation on reuse · helmet · CORS allowlist ·
rate limiting on `/auth` · Zod validation at every boundary · no user enumeration.

## Scripts (run on host or via `docker compose exec app …`)

```bash
npm run dev        # tsx watch (default container command)
npm run build      # tsc -> dist/
npm start          # node dist/server.js
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm test           # vitest; in-memory MongoDB on host (downloads a binary)
```

Inside a container (e.g. arm64, where the in-memory binary is unavailable),
point the suite at a real Mongo instead — no download:

```bash
# with a mongo service reachable as `mongo`:
MONGODB_TEST_URI=mongodb://mongo:27017/test npm test
```

## Layout

```
src/
  config/env.ts              zod-validated environment
  db/connect.ts              mongoose connection
  models/                    User (preferences embedded), VerificationToken, RefreshToken
  lib/                       password, tokens, jwt, mailer, logger, errors
  middleware/                requireAuth, errorHandler, rateLimit
  modules/auth/              register · verify · login · refresh · logout · resend
  modules/preferences/       GET/PUT /me/preferences
  app.ts · server.ts
test/                        end-to-end flow (Vitest + mongodb-memory-server)
```

## Notes / future work

- Refresh token lives in an httpOnly cookie (ideal for a same-origin web client).
  A cross-origin browser-extension client would instead store it in extension
  storage and send it in the body — switch the transport in `auth/controller.ts`.
- Password reset reuses the `VerificationToken` model (add a `password_reset` type).
- No production Dockerfile yet — dev image only.
