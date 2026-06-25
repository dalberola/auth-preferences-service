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
| CAPTCHA on register | ➕ recommended add-on | not implemented |

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

## CAPTCHA (recommended add-on)

Not implemented. To deter automated account creation and reset-flooding, add a
CAPTCHA / challenge (e.g. Turnstile, reCAPTCHA, hCaptcha) verified at the `register`
(and optionally `forgot-password`) controller before the handler runs. The
generic-202 responses already limit enumeration; a challenge raises the cost of
bulk abuse.

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
