# API reference

Base URL (dev): `http://localhost:4000`. All request/response bodies are JSON.
Errors share the shape `{ "error": { "code": "...", "message": "..." } }`
(validation errors add `details`).

## Conventions

- **Access token**: `Authorization: Bearer <jwt>` header. Short-lived (`ACCESS_TTL`, default 15m).
- **Refresh token**: delivery depends on `REFRESH_TOKEN_TRANSPORT`. Default `cookie` — httpOnly cookie `refresh_token` scoped to `/auth`, sent automatically by browsers. `body` — returned in the login/refresh JSON (`refreshToken`, `refreshExpiresAt`) and sent back in the request body `{ "refreshToken": "…" }`. Rotated on every refresh. See [security.md](security.md).
- **Rate limits**: `/auth/*` 20 req / 15 min; `/me/*` 100 req / 15 min (disabled under `NODE_ENV=test`).

---

## `GET /health`

Liveness probe. → `200 { "status": "ok" }`.

## `POST /auth/register`

```json
{ "email": "user@example.com", "password": "min-12-chars" }
```

Creates an unverified account and emails a verification link. Always returns the
same generic response regardless of whether the email already exists (no
enumeration). Password must be ≥ 12 characters.

When `RECAPTCHA_SECRET` is configured, the body must also include a
`captchaToken` (reCAPTCHA v3, action `register`); a missing or low-scoring token
is rejected with `400 CAPTCHA_FAILED`. The field is ignored when CAPTCHA is
disabled (the default).

→ `202 { "message": "If the email is valid, a verification link has been sent." }`

```bash
curl -sX POST localhost:4000/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"user@example.com","password":"Sup3rSecret!pw"}'
```

## `GET /auth/verify?token=<raw>`

Consumes a verification token (single-use, 24h TTL) and marks the email verified.

→ `302` redirect to `${CLIENT_URL}/?verified=1`
→ `401 INVALID_TOKEN` if missing/expired/already-consumed

## `POST /auth/login`

```json
{ "email": "user@example.com", "password": "..." }
```

→ `200 { "accessToken": "<jwt>" }` + `Set-Cookie: refresh_token=…`
→ `401 INVALID_CREDENTIALS` · `403 EMAIL_NOT_VERIFIED`

```bash
curl -sX POST localhost:4000/auth/login -c cookies.txt \
  -H 'content-type: application/json' \
  -d '{"email":"user@example.com","password":"Sup3rSecret!pw"}'
```

## `POST /auth/refresh`

Sends the `refresh_token` cookie; rotates it and returns a fresh access token.
Replaying an already-rotated token triggers `TOKEN_REUSE` and revokes the whole
token family.

→ `200 { "accessToken": "<jwt>" }` + rotated cookie
→ `401 NO_TOKEN | INVALID_TOKEN | TOKEN_REUSE`

```bash
curl -sX POST localhost:4000/auth/refresh -b cookies.txt -c cookies.txt
```

## `POST /auth/logout`

Revokes the current refresh token and clears the cookie. Idempotent.

→ `204`

## `POST /auth/resend-verification`

```json
{ "email": "user@example.com" }
```

Re-issues a verification link for an existing unverified account; no-op otherwise.
Always generic (no enumeration). → `202`.

## `POST /auth/forgot-password`

```json
{ "email": "user@example.com" }
```

Issues a single-use password-reset token (1h TTL) and emails a reset link to
`${CLIENT_URL}/reset-password?token=…`. Always generic regardless of whether the
account exists (no enumeration). → `202`.

Accepts an optional `captchaToken` (action `forgot_password`), enforced only when
`RECAPTCHA_SECRET` is configured — `400 CAPTCHA_FAILED` on failure.

## `POST /auth/reset-password`

```json
{ "token": "<raw>", "password": "min-12-chars" }
```

Consumes the reset token, sets the new password (argon2id), and **revokes all of
the user's refresh tokens** (every existing session must re-authenticate).

→ `204`
→ `401 INVALID_TOKEN` if missing/expired/already-consumed
→ `400 VALIDATION_ERROR` if the new password is < 12 chars

## `GET /me/preferences`  *(auth required)*

→ `200 { "preferences": { "theme": "system", "locale": "en", "schemaVersion": 1, "settings": {} } }`

```bash
curl -s localhost:4000/me/preferences -H "authorization: Bearer $ACCESS"
```

## `PUT /me/preferences`  *(auth required)*

Partial update — only supplied keys change. Unknown top-level keys are rejected
(`strict` schema).

```json
{ "theme": "dark", "locale": "en", "settings": { "anyKey": "anyJsonValue" } }
```

→ `200 { "preferences": { … } }`

```bash
curl -sX PUT localhost:4000/me/preferences \
  -H "authorization: Bearer $ACCESS" -H 'content-type: application/json' \
  -d '{"theme":"dark","settings":{"widgetA":true}}'
```

## `DELETE /me`  *(auth required)*

Permanently deletes the authenticated account and cascade-deletes its refresh and
verification tokens in one transaction. Clears the refresh cookie (cookie transport).
**Idempotent** — a repeat call with a still-valid access token also returns `204`.

→ `204` (no body)

```bash
curl -sX DELETE localhost:4000/me -H "authorization: Bearer $ACCESS" -i
```

Gated by the access token only (no password re-entry). The JWT is stateless, so it
stays valid until it expires; afterwards any authenticated `/me` request returns
`401 USER_NOT_FOUND`. Deletion is final — there is no recovery.

## Error codes

| Code | Status | Meaning |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | Body/query failed Zod validation (`details` included) |
| `MALFORMED_BODY` | 400 | Request body is not valid JSON |
| `CAPTCHA_FAILED` | 400 | reCAPTCHA token missing, low-scoring, or rejected (when enabled) |
| `INVALID_CREDENTIALS` | 401 | Wrong email/password (generic) |
| `EMAIL_NOT_VERIFIED` | 403 | Login blocked until verification |
| `INVALID_TOKEN` | 401 | Bad/expired verification, access, or refresh token |
| `NO_TOKEN` | 401 | Missing bearer or refresh token |
| `TOKEN_REUSE` | 401 | Rotated refresh token replayed; family revoked |
| `USER_NOT_FOUND` | 401 | Authenticated user no longer exists |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL` | 500 | Unhandled error |
