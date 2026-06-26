# Deployment & production hardening

How to run the service in production and the checklist that tracks production
readiness ([#5](https://github.com/dalberola/auth-preferences-service/issues/5)).
For the local Docker workflow and the image build see
[development.md](development.md); for the controls already in code see
[security.md](security.md).

## The production image

`Dockerfile` is a multi-stage, non-root image that compiles to `dist/` and runs
`node dist/server.js` with `NODE_ENV=production`. It applies pending TypeORM
migrations automatically on startup (`migrationsRun`), so it builds its schema on
first boot against an empty database. Build and run details are in
[development.md](development.md#production-image); `compose.prod.yml` runs it
locally against bundled MariaDB/Mailpit.

Real deployments provide their own managed **MariaDB** and **SMTP**, and inject
configuration via the environment (see [configuration.md](configuration.md)).

## Live production: Infomaniak shared hosting (auth.diginaut.es)

The actual production instance runs on **Infomaniak shared hosting** as a managed
**Node.js site** — built and run by Infomaniak's **Node.js Builder**, **not** the
Docker image and **not** an SSH file-deploy. The consumer is the maintainer's
tabliss site at `https://diginaut.es`. The `Dockerfile`/`compose.prod.yml` remain
for other (container) targets only.

**Why not the other mechanisms:** Infomaniak shared hosting refuses inbound SSH
**key** auth (password-only) and caps SSH CPU/RAM, so neither an agent-driven SSH
deploy nor a GitHub-Actions-over-SSH deploy works. Instead Infomaniak clones the
(public) GitHub repo and builds it on boosted infra.

### Manager configuration (Node.js site)

| Field | Value | Notes |
| --- | --- | --- |
| Node.js version | **24** | matches `engines` (`>=24`) |
| Execution Folder | **`./`** | repo root (has `package.json`) |
| Build Command | **`npm ci && npm run build`** | see gotcha below |
| Start Command | **`npm start`** | → `node dist/server.js` |
| Listening port | **injected** | Infomaniak sets `PORT`; the app reads it (`server.ts`). Do **not** set `PORT` in `.env`. |

Source is the public GitHub repo (branch `main`); build/start/restart and the live
logs are driven from the Manager dashboard (Build console + Execution console).

### Gotchas (learned deploying this)

- **`npm run install` is not `npm install`.** Infomaniak's default build command
  `npm run install && npm run build` runs an `install` *script* (which this repo
  doesn't have) — so it installs **nothing**, and the runtime boots with no
  `node_modules` → `ERR_MODULE_NOT_FOUND` for `reflect-metadata`/`dotenv`. Use
  **`npm ci && npm run build`**. (`dist/` and `node_modules` are both absent from a
  fresh clone — the build must produce them on every deploy.)
- **Env vars live in a host-side `.env`, not in GitHub.** GitHub Actions
  secrets/variables are invisible to Infomaniak (it only `git clone`s the files).
  Put runtime config in a **`.env` in the execution folder**; the app loads it via
  dotenv, and it's git-ignored so a git-pull deploy never clobbers it.
- **Single-quote secret values in `.env`.** dotenv treats an unquoted `#` as an
  inline comment and trims spaces, silently **truncating** a password
  (`DB_PASSWORD='…'`, `SMTP_PASS='…'`). A truncated password surfaces as MariaDB
  `ER_ACCESS_DENIED_ERROR (1045)` even though the value "looks right".
- **Managed MariaDB needs remote access.** The app connects from Infomaniak's
  egress gateway (`egress-gateway-prod-01.infomaniak.ch`), so the DB user must be
  granted for it (enable remote access / host `%` in the Manager → Databases). The
  DB host is `<id>.myd.infomaniak.com:3306`.
- **A green `npm start` ≠ serving.** Until the app listens on the injected `PORT`,
  Infomaniak serves an Express "under maintenance" placeholder (`/health` 301→
  `/health/`). A live app returns `200 {"status":"ok"}` at `/health`.

### Production env (canonical vars)

`NODE_ENV=production`, `TRUST_PROXY=1`, managed MariaDB `DB_*`, a **fresh**
`JWT_ACCESS_SECRET` (not reused from dev), SMTP `mail.infomaniak.com:587` with
`SMTP_SECURE=false` (STARTTLS), `MAIL_FROM="Diginaut <hello@diginaut.es>"`,
`APP_URL=https://auth.diginaut.es`, `CLIENT_URL=https://diginaut.es`,
`REFRESH_TOKEN_TRANSPORT=cookie`. TLS is terminated by Infomaniak, so
`NODE_ENV=production` makes the refresh cookie `Secure`; `diginaut.es` ↔
`auth.diginaut.es` are **same-site**, so `SameSite=Lax` is sent on the consumer's
credentialed requests (verified live).

### Deploying an update

Push to `main`, then in the Manager: run **Build** (re-clones + `npm ci && npm run
build`) and **Restart**. Migrations run automatically on the production boot
(`migrationsRun`).

## Hardening checklist

| Item | Status | Where |
| --- | --- | --- |
| Production image (multi-stage, non-root) | ✅ in code | `Dockerfile` |
| Schema via migrations (not `synchronize`) | ✅ in code | `db/data-source.ts` |
| Configurable `trust proxy` | ✅ in code | `TRUST_PROXY` |
| SMTP implicit TLS | ✅ in code | `SMTP_SECURE` |
| Per-account login lockout | ✅ in code | `modules/auth/service.ts` |
| HTTPS only / `Secure` cookies | ⚙️ operator | TLS at the proxy + `NODE_ENV=production` |
| Secrets in a managed store + rotation | ⚙️ operator | inject env from a secret store |
| Real SMTP + SPF/DKIM/DMARC | ⚙️ operator | mail provider + DNS |
| Headers / CORS for prod origins | ⚙️ operator | `CLIENT_URL`, `TRUST_PROXY` |
| CAPTCHA on register | ✅ in code (opt-in) | set `RECAPTCHA_SECRET` to enable |

## TLS / HTTPS

Terminate TLS at a reverse proxy or load balancer in front of the app; the Node
process speaks plain HTTP on `PORT` behind it.

- Set **`NODE_ENV=production`** (baked into the image): this makes the refresh-token
  cookie `Secure` (`modules/auth/controller.ts`) and switches the schema to
  migrations.
- Set **`TRUST_PROXY`** to the number of proxy hops in front of the app (`1` for a
  single ingress/LB). Without it Express sees the proxy's IP, breaking per-IP rate
  limiting and the `Secure`-cookie decision. See [configuration.md](configuration.md).
- `helmet` emits **HSTS** (`Strict-Transport-Security`) by default; it only takes
  effect over HTTPS.

## Secrets & rotation

Inject secrets from a managed store (cloud secret manager, Vault, orchestrator
secrets) as environment variables — never bake them into the image or commit them.
Required: `JWT_ACCESS_SECRET`, `DB_PASSWORD`, and any `SMTP_*` credentials.

- **`JWT_ACCESS_SECRET`** signs/verifies access JWTs (HS256, `lib/jwt.ts`). New
  tokens are always signed with it; refresh tokens are opaque DB records, unaffected.
  **Zero-downtime rotation:** set `JWT_ACCESS_SECRET_PREVIOUS` to the *current*
  secret, then set `JWT_ACCESS_SECRET` to the *new* one. Verification accepts either,
  so live tokens keep working; once the overlap exceeds `ACCESS_TTL` (default 15m)
  every old token has expired — remove `JWT_ACCESS_SECRET_PREVIOUS`. Skipping the
  overlap (rotating `JWT_ACCESS_SECRET` alone) still works but forces every client
  to re-`/auth/refresh`.
- Refresh tokens are **opaque random values stored as sha256 hashes**, not JWTs, so
  there is no refresh-signing secret to rotate.

## Email deliverability

Use a real SMTP provider and authenticate the sending domain so verification and
password-reset mail is delivered, not spam-filtered:

- Point `SMTP_HOST`/`SMTP_PORT` at the provider and set `SMTP_USER`/`SMTP_PASS`.
  Use `SMTP_SECURE=true` for implicit TLS (port 465); leave `false` for STARTTLS
  (587/25).
- Set `MAIL_FROM` to an address on a domain you control.
- Publish DNS records for that domain: **SPF** (authorize the provider's senders),
  **DKIM** (provider-supplied signing key), and a **DMARC** policy.

## Headers & CORS

- `helmet()` sets a strict default header set (CSP, HSTS, `X-Content-Type-Options`,
  `X-Frame-Options`, COOP/CORP, referrer policy, and removes `X-Powered-By`). The
  service returns only JSON, so the default CSP is not relied upon for rendering.
- CORS is a **strict allowlist of exactly `CLIENT_URL`** with credentials enabled
  (`app.ts`). Set `CLIENT_URL` to the exact production origin (scheme + host +
  port) of the web client; a mismatch blocks the browser from sending credentials.

## Rate limiting, lockout & scaling

- Per-IP limits (`/auth/*` 20 / 15 min, `/me/*` 100 / 15 min) and per-account
  lockout are implemented (see [security.md](security.md)). Tune via the limiter and
  `LOGIN_MAX_ATTEMPTS` / `LOGIN_LOCK_MINUTES`.
- **Multi-instance caveat:** the IP limiter uses `express-rate-limit`'s default
  in-memory store, so counters are **per process** and reset on restart. Running
  more than one replica weakens it proportionally — back it with a shared store
  (e.g. Redis) for horizontal scaling. Account **lockout is DB-backed**, so it is
  already shared across instances.

## CAPTCHA (reCAPTCHA v3 — opt-in)

Implemented and **off by default**. `register` and `forgot-password` verify a
reCAPTCHA v3 `captchaToken` server-side (`lib/recaptcha.ts`) before the handler
runs, raising the cost of automated account creation and reset-flooding on top of
the generic-202 responses, the per-IP limiter, and per-account lockout.

To enable: set `RECAPTCHA_SECRET` (and tune `RECAPTCHA_MIN_SCORE`, default 0.5);
the client must execute reCAPTCHA v3 with actions `register` / `forgot_password`
and send the resulting token as `captchaToken`. A definitive failure returns
`400 CAPTCHA_FAILED`; a provider outage fails open (see
[security.md](security.md#bot-protection-captcha)). `RECAPTCHA_VERIFY_URL`
overrides the siteverify endpoint for tests/self-hosted proxies.

## Database

- Use a managed MariaDB with automated backups and point-in-time recovery.
- Migrations run automatically on deploy via the image (`migrationsRun`); for
  multi-instance rollouts run them as a one-shot job before scaling up the new
  version so instances don't race. See [development.md](development.md#migrations).
- The token reaper deletes expired rows on an interval (`REAP_INTERVAL_MINUTES`) —
  MariaDB has no TTL index.

## Graceful shutdown

On `SIGTERM`/`SIGINT` the server stops the reaper, closes the HTTP listener (stops
accepting new connections and drains in-flight requests), closes the DB pool, and
exits 0. A bounded timer (8s) force-exits if a connection hangs. Ensure the
orchestrator's stop grace period is **≥ 8s** (Docker's default `docker stop`
timeout is 10s; in Kubernetes set `terminationGracePeriodSeconds` accordingly) so
the process finishes draining before `SIGKILL`.
