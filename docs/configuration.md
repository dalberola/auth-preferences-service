# Configuration

All config comes from environment variables, validated by Zod in
`src/config/env.ts` at startup. **Invalid or missing config aborts the process**
with a readable error — there are no silent defaults for secrets.

## Loading & precedence

```
process.env   >   .env.local   >   .env
```

`env.ts` loads `.env.local` then `.env`; dotenv never overrides an already-set
key, so real environment variables (e.g. those injected by docker-compose) win,
then `.env.local`, then `.env`. Put **real secrets in `.env.local`** — it is
git-ignored by the repo's own `.gitignore` (`.env.*`, with `!.env.example`).
docker-compose loads both files, each optional, `.env.local` last.

## Variables

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `NODE_ENV` | no | `development` | `development \| test \| production` |
| `PORT` | no | `4000` | must be > 0 |
| `MONGODB_URI` | **yes** | — | e.g. `mongodb://mongo:27017/auth_preferences` |
| `JWT_ACCESS_SECRET` | **yes** | — | ≥ 32 chars; `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | **yes** | — | ≥ 32 chars; **different** from access |
| `ACCESS_TTL` | no | `15m` | zeit/ms format for the access JWT |
| `REFRESH_TTL_DAYS` | no | `14` | refresh-token lifetime in days |
| `SMTP_HOST` | **yes** | — | `mailpit` in compose |
| `SMTP_PORT` | no | `1025` | Mailpit SMTP port |
| `SMTP_USER` | no | — | omit for Mailpit (no auth) |
| `SMTP_PASS` | no | — | |
| `MAIL_FROM` | **yes** | — | e.g. `Auth <no-reply@example.com>` |
| `APP_URL` | **yes** | — | base URL of THIS service; builds the verify link |
| `CLIENT_URL` | **yes** | — | CORS allowlist origin + post-verify redirect |

## docker-compose overrides

`docker-compose.yml` sets `MONGODB_URI`, `SMTP_HOST`, `SMTP_PORT` in the `app`
service's `environment:` block so they always point at the compose-network
services (`mongo`, `mailpit`) regardless of what your env files say. Secrets
(`JWT_*`) still come from `.env.local`/`.env`.

## Generating secrets

```bash
openssl rand -hex 32   # run twice; one for each JWT secret
```
