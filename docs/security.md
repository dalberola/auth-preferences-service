# Security

The controls below are implemented in the service. This is a dev-grade baseline;
production hardening notes are at the end.

## Passwords
- Hashed with **argon2id** (`lib/password.ts`). Plaintext is never stored or logged.
- Minimum length 12 (enforced by the Zod register schema).
- `verifyPassword` returns `false` on any argon2 error rather than throwing.

## Tokens
- **Verification** and **refresh** tokens are 32 random bytes (`crypto.randomBytes`),
  base64url-encoded.
- Only the **sha256 hash** is persisted; the raw value exists solely in the email
  link or the API response. A database leak does not expose usable tokens.
- Verification (and password-reset) tokens are **single-use** (`consumedAt`) and
  time-limited (24h verify, 1h reset). Expired tokens are deleted by the
  background **reaper** (`db/reaper.ts`) — MariaDB has no TTL index.

## Sessions
- **Access token**: HS256 JWT, `sub = userId`, short TTL (default 15m), sent in the
  response body and carried as `Authorization: Bearer`.
- **Refresh token**: lifetime `REFRESH_TTL_DAYS` (default 14); expired rows are
  removed by the reaper. Delivery is configurable — see *Refresh-token transport*.
- **Rotation**: every `/auth/refresh` revokes the presented token and issues a new
  one in the same `family`.
- **Reuse detection**: presenting an already-revoked refresh token revokes the
  entire family (`TOKEN_REUSE`) — mitigates stolen-token replay.

## Refresh-token transport
Selectable via `REFRESH_TOKEN_TRANSPORT` (switch point in
`modules/auth/controller.ts`). Rotation and reuse detection are identical in both.

- **`cookie`** (default) — httpOnly cookie, `SameSite=Lax`, `Secure` in
  production, scoped to `path=/auth`. Invisible to JS, so it resists XSS
  exfiltration, and the browser sends it automatically. Best for a **same-origin
  web client**; cross-site use is constrained by `SameSite`/CORS.
- **`body`** — the refresh token is returned in the login/refresh JSON response
  and must be sent back in the request body (`{ "refreshToken": "…" }`); no cookie
  is set. Needed for **cross-origin or browser-extension** clients that can't rely
  on the cookie, but the client must store it securely (e.g. extension storage) —
  if kept in JS-reachable web storage it is exposed to XSS.

## Account enumeration
`register`, `resend-verification`, and `login` return generic responses/timing-
neutral errors so an attacker cannot probe which emails are registered or verified.

## Transport & headers
- `helmet` sets secure response headers.
- `cors` is an **allowlist** of exactly `CLIENT_URL`, with credentials enabled.
- JSON body capped at 100kb.

## Rate limiting
`express-rate-limit`: `/auth/*` 20 req / 15 min, `/me/*` 100 req / 15 min
(`lib`/`middleware/rateLimit.ts`; disabled under `NODE_ENV=test`). This is
**per-IP** — accurate client-IP attribution behind a proxy depends on `TRUST_PROXY`.

## Account lockout
Complementing the per-IP limiter, login failures are throttled **per account**
(`modules/auth/service.ts`). After `LOGIN_MAX_ATTEMPTS` (default 5) consecutive
failures the account is locked for `LOGIN_LOCK_MINUTES` (default 15); a correct
login clears the counter and an elapsed lock auto-resets. While locked, login
returns the **same generic `INVALID_CREDENTIALS`** as a bad password — it never
reveals that the account exists or is locked (consistent with the enumeration
posture above). Trade-off: an attacker who knows an address can keep it locked by
forcing failures; the time-boxed auto-unlock bounds that denial of service.

## Input validation
Every request body/query is parsed with a Zod schema at the controller boundary;
failures become `400 VALIDATION_ERROR`. The preferences schema is `strict` —
unknown keys are rejected.

## Production hardening
Several controls above are in code: per-account lockout, the per-IP limiter, the
production image, migrations-based schema, configurable `TRUST_PROXY`, and
`SMTP_SECURE`. The remaining items are operator responsibilities (TLS termination,
secrets in a managed store + rotation, real SMTP with SPF/DKIM/DMARC, CORS for prod
origins) and a recommended CAPTCHA add-on.

See the **[deployment runbook](deployment.md)** for the full checklist, what is
implemented vs. operator-owned, and step-by-step guidance — including the
multi-instance caveat that the IP limiter's store is in-memory (lockout is
DB-backed), and the unused `JWT_REFRESH_SECRET`
([#21](https://github.com/dalberola/auth-preferences-service/issues/21)).
