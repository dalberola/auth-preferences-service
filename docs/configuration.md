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
| `TRUST_PROXY` | no | `1` | Express `trust proxy`: hop count, or `false`/`true`/preset/CSV IP list |
| `DB_HOST` | **yes** | — | MariaDB host; `mariadb` in compose |
| `DB_PORT` | no | `3306` | MariaDB port |
| `DB_USER` | **yes** | — | MariaDB user |
| `DB_PASSWORD` | no | `""` | MariaDB password |
| `DB_NAME` | **yes** | — | database name, e.g. `auth_preferences` |
| `JWT_ACCESS_SECRET` | **yes** | — | ≥ 32 chars; `openssl rand -hex 32` |
| `JWT_ACCESS_SECRET_PREVIOUS` | no | — | old secret accepted on verify during a rotation overlap; ≥ 32 chars |
| `ACCESS_TTL` | no | `15m` | zeit/ms format for the access JWT |
| `REFRESH_TTL_DAYS` | no | `14` | refresh-token lifetime in days |
| `LOGIN_MAX_ATTEMPTS` | no | `5` | consecutive failed logins before a per-account lock |
| `LOGIN_LOCK_MINUTES` | no | `15` | how long an account stays locked |
| `REAP_INTERVAL_MINUTES` | no | `60` | how often the reaper deletes expired tokens |
| `INACTIVITY_PURGE_MONTHS` | no | `12` | delete accounts idle (no login/refresh) longer than this |
| `INACTIVITY_WARNING_DAYS` | no | `30` | send a "sign in to keep your account" email this many days before the cutoff |
| `REFRESH_TOKEN_TRANSPORT` | no | `cookie` | `cookie` (httpOnly cookie) or `body` (JSON body) — see security.md |
| `SMTP_HOST` | **yes** | — | `mailpit` in compose |
| `SMTP_PORT` | no | `1025` | Mailpit SMTP port |
| `SMTP_SECURE` | no | `false` | implicit TLS (SMTPS, port 465); leave `false` for STARTTLS / Mailpit |
| `SMTP_USER` | no | — | omit for Mailpit (no auth) |
| `SMTP_PASS` | no | — | |
| `MAIL_FROM` | **yes** | — | e.g. `Auth <no-reply@example.com>` |
| `APP_URL` | **yes** | — | base URL of THIS service; builds the verify link |
| `CLIENT_URL` | **yes** | — | CORS allowlist origin + post-verify redirect |

## docker-compose overrides

`docker-compose.yml` sets `DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASSWORD`/`DB_NAME`,
`SMTP_HOST`, and `SMTP_PORT` in the `app` service's `environment:` block so they
always point at the compose-network services (`mariadb`, `mailpit`) regardless of
what your env files say. Secrets (`JWT_*`) still come from `.env.local`/`.env`.

## Generating secrets

```bash
openssl rand -hex 32   # for JWT_ACCESS_SECRET
```
