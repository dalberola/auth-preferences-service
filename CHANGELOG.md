# Changelog

All notable changes to this project are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); versions are git tags +
[GitHub releases](https://github.com/dalberola/auth-preferences-service/releases).

## [Unreleased]

_Track in-flight work via [issues](https://github.com/dalberola/auth-preferences-service/issues)
and [milestones](https://github.com/dalberola/auth-preferences-service/milestones)._

## [1.4.0] - 2026-06-26

Production-launch milestone — the service is live at
[auth.diginaut.es](https://auth.diginaut.es) on Infomaniak managed Node.js
(see `docs/deployment.md`).

### Added
- **Self-service account deletion**
  ([#49](https://github.com/dalberola/auth-preferences-service/issues/49)):
  `DELETE /me` permanently deletes the authenticated account and cascade-deletes
  its refresh + verification tokens in one transaction, clears the refresh cookie,
  and is idempotent (`204`). Access-token-gated; see `docs/api.md`.
- **Inactivity account deletion**
  ([#48](https://github.com/dalberola/auth-preferences-service/issues/48)):
  accounts idle past `INACTIVITY_PURGE_MONTHS` (default 12) are purged by the
  reaper, preceded by a warning email `INACTIVITY_WARNING_DAYS` (default 30)
  before the cutoff. `lastActiveAt` is refreshed on login **and** token refresh.
  Fulfils the Privacy Policy's auto-deletion commitment.
- **reCAPTCHA v3 bot protection (opt-in)**
  ([#36](https://github.com/dalberola/auth-preferences-service/issues/36)):
  `register` and `forgot-password` verify a `captchaToken` server-side when
  `RECAPTCHA_SECRET` is set (disabled by default). Definitive failures return
  `400 CAPTCHA_FAILED`; provider outages fail open. Tunable via
  `RECAPTCHA_MIN_SCORE` / `RECAPTCHA_VERIFY_URL`.
- **Consent recording at registration**
  ([#45](https://github.com/dalberola/auth-preferences-service/issues/45)):
  `POST /auth/register` now requires `acceptedTerms: true` (registration is
  blocked otherwise) and records the accepted Terms/Privacy version + timestamp
  on the user (`consentVersion`/`consentAt`; migration `AddUserConsent`). The
  optional `consentVersion` field is recorded as sent, else the server's current
  `CONSENT_VERSION` (`2026-06-25`, tied to the consumer's legal pages). Supports
  the tabliss account/sync onboarding.

### Fixed
- **Single `/me` guard**
  ([#51](https://github.com/dalberola/auth-preferences-service/issues/51)):
  `apiLimiter` + `requireAuth` are applied once at the `/me` mount instead of per
  router, so `DELETE /me` no longer double-counts the rate limiter.

## [1.3.0] - 2026-06-25

### Added
- **Zero-downtime access-secret rotation**
  ([#35](https://github.com/dalberola/auth-preferences-service/issues/35)): an
  optional `JWT_ACCESS_SECRET_PREVIOUS` is accepted on verify during a rotation
  overlap, so rotating `JWT_ACCESS_SECRET` no longer invalidates live access tokens.
  New tokens are always signed with the current secret. Runbook in
  `docs/deployment.md`.

## [1.2.0] - 2026-06-25

### Security
- **Close the login timing oracle**
  ([#30](https://github.com/dalberola/auth-preferences-service/issues/30)): login
  skipped argon2 for unknown emails, so response time revealed whether an address
  was registered. It now verifies against a precomputed dummy hash on the no-user
  path, equalizing timing. `security.md`'s enumeration section is reconciled with
  the actual behavior (including the accepted `403 EMAIL_NOT_VERIFIED` and
  forgot/resend residuals).
- **Redact credentials and tokens from request logs**
  ([#29](https://github.com/dalberola/auth-preferences-service/issues/29)): the
  default `pino-http` config logged the `Authorization`/`Cookie` request headers,
  the `Set-Cookie` response header, and the verification `token` (in the URL and
  parsed `query`) in plaintext. Added pino `redact` rules (`lib/logger.ts`) and a
  regression test so these never reach logs.

## [1.1.0] - 2026-06-25

### Added
- **Graceful shutdown** ([#26](https://github.com/dalberola/auth-preferences-service/issues/26)):
  on `SIGTERM`/`SIGINT` the server stops the reaper, closes the HTTP listener
  (draining in-flight requests), closes the DB pool, and exits — with an 8s
  force-exit fallback. Containers now stop cleanly instead of being killed
  mid-request.

### Documentation
- Refreshed the README **Future work** section: its three items (cross-origin
  refresh-token transport, password-reset token type, production Dockerfile) all
  shipped in v0.3.0/v1.0.0. Replaced them with the genuinely-open directions from
  the deployment runbook (shared rate-limit store, zero-downtime secret rotation,
  CAPTCHA on register).

## [1.0.0] - 2026-06-25

### Added
- **Production Docker image** ([#4](https://github.com/dalberola/auth-preferences-service/issues/4)):
  multi-stage `Dockerfile` (build → prod-deps → runtime) that compiles to `dist/`,
  installs production-only dependencies (`npm ci --omit=dev`), runs as the non-root
  `node` user, and starts `node dist/server.js` with `NODE_ENV=production` and a
  `/health` HEALTHCHECK. `compose.prod.yml` runs the image locally against bundled
  MariaDB/Mailpit.
- **Database migrations** ([#5](https://github.com/dalberola/auth-preferences-service/issues/5)):
  production now owns its schema through TypeORM migrations instead of
  `synchronize`. Added the initial schema migration and `migration:generate` /
  `migration:run` / `migration:revert` / `migration:show` scripts (TypeORM CLI via
  `tsx`). The prod image applies pending migrations automatically on startup
  (`migrationsRun`); dev/test keep `synchronize`.
- **Production config knobs** ([#5](https://github.com/dalberola/auth-preferences-service/issues/5)):
  `TRUST_PROXY` makes Express's `trust proxy` configurable (hop count / `false` /
  `true` / preset / CSV IP list) instead of the hardcoded `1`, so client-IP rate
  limiting and `Secure`-cookie decisions are correct behind real proxies;
  `SMTP_SECURE` enables implicit TLS (SMTPS, port 465) for real mail providers.
- **Per-account login lockout** ([#5](https://github.com/dalberola/auth-preferences-service/issues/5)):
  after `LOGIN_MAX_ATTEMPTS` (default 5) consecutive failures an account locks for
  `LOGIN_LOCK_MINUTES` (default 15), complementing the per-IP rate limiter. A
  correct login clears the counter; an elapsed lock auto-resets. While locked,
  login returns the same generic `INVALID_CREDENTIALS` (no enumeration). Adds the
  `failedLoginAttempts` / `lockedUntil` columns via migration.

### Removed
- **`JWT_REFRESH_SECRET`** config variable
  ([#21](https://github.com/dalberola/auth-preferences-service/issues/21)): it was
  required but read nowhere — refresh tokens are opaque random values stored as
  sha256 hashes, not JWTs, so the secret signed nothing. Deployments can drop it
  from their environment; only `JWT_ACCESS_SECRET` is needed.

### Documentation
- **Deployment & hardening runbook** (`docs/deployment.md`,
  [#5](https://github.com/dalberola/auth-preferences-service/issues/5)): the
  production-readiness checklist with implemented-vs-operator status and guidance
  for TLS, secrets/rotation, SMTP + SPF/DKIM/DMARC, headers/CORS, CAPTCHA, and the
  multi-instance rate-limiter caveat. Refreshed `security.md`'s hardening section.

## [0.3.0] - 2026-06-24

### Changed
- **BREAKING:** migrated persistence from MongoDB/Mongoose to **TypeORM 1.0 +
  MariaDB** ([#6](https://github.com/dalberola/auth-preferences-service/issues/6)).
  Entities replace Mongoose schemas; UUID primary keys keep IDs opaque so the API
  contract is unchanged. `preferences` is now a JSON column (read-merge-save
  partial updates). Config swaps `MONGODB_URI` for `DB_HOST`/`DB_PORT`/`DB_USER`/
  `DB_PASSWORD`/`DB_NAME`. Docker stack and CI now run MariaDB; the test harness
  runs against a real MariaDB (the `mongodb-memory-server` dependency and its
  arm64 binary gotcha are gone).

### Added
- **Configurable refresh-token transport** (`REFRESH_TOKEN_TRANSPORT`,
  [#2](https://github.com/dalberola/auth-preferences-service/issues/2)): keep the
  default httpOnly `cookie`, or switch to `body` so cross-origin / browser-extension
  clients receive the refresh token in the JSON response and send it back in the
  request body. Trade-offs documented in `docs/security.md`.
- **Password reset** flow ([#1](https://github.com/dalberola/auth-preferences-service/issues/1)):
  `POST /auth/forgot-password` (generic 202, no enumeration) issues a single-use
  reset token (1h TTL) emailed to the client; `POST /auth/reset-password` sets the
  new password and revokes all of the user's refresh tokens (forces re-login).
- Background **token reaper** (`src/db/reaper.ts`) deleting expired refresh and
  verification tokens on an interval (`REAP_INTERVAL_MINUTES`, default 60),
  replacing MongoDB's TTL index ([#7](https://github.com/dalberola/auth-preferences-service/issues/7)).
  Reaps by expiry only, so revoked-but-unexpired refresh tokens are retained for
  reuse detection.

### Fixed
- Malformed JSON request bodies now return `400 MALFORMED_BODY` instead of a
  generic `500` ([#13](https://github.com/dalberola/auth-preferences-service/issues/13)).

## [0.1.0] - 2026-06-24

Initial dev-ready baseline.

### Added
- Registration → email verification → login with JWT access + rotating refresh
  tokens (family-based reuse detection).
- Per-user preferences (`GET`/`PUT /me/preferences`), embedded in the user doc.
- argon2id passwords; sha256-hashed, single-use, TTL-indexed tokens.
- Zod validation, helmet, CORS allowlist, rate limiting, central error handler.
- Mongoose connection with retry/backoff; Docker dev stack (app + mongo + mailpit)
  with a Mongo healthcheck gating app startup.
- `.env.local` config precedence; portable test harness (`MONGODB_TEST_URI`).
- Documentation (`README`, `CLAUDE.md`, `docs/`), Claude Code skills (`.claude/`),
  and a guided AI onboarding flow.
- CI via GitHub Actions (typecheck + lint + test against a Mongo service).

[Unreleased]: https://github.com/dalberola/auth-preferences-service/compare/v1.4.0...HEAD
[1.4.0]: https://github.com/dalberola/auth-preferences-service/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/dalberola/auth-preferences-service/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/dalberola/auth-preferences-service/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/dalberola/auth-preferences-service/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/dalberola/auth-preferences-service/compare/v0.3.0...v1.0.0
[0.3.0]: https://github.com/dalberola/auth-preferences-service/compare/v0.1.0...v0.3.0
[0.1.0]: https://github.com/dalberola/auth-preferences-service/releases/tag/v0.1.0
