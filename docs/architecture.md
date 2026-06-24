# Architecture

## Overview

A single stateless Express service backed by MongoDB. Three capabilities:
**register**, **verify email**, **read/write preferences**. Authentication is
JWT-based (short-lived access token + rotating refresh token). Email is sent via
SMTP (Mailpit in dev).

```
Client ──HTTPS──> Express app
                    ├─ middleware: helmet · cors(allowlist) · json · cookieParser · pino-http · rateLimit
                    ├─ /health
                    ├─ /auth   register · verify · login · refresh · logout · resend-verification
                    └─ /me     preferences (requireAuth)
                          │
                          ├─ controller  (parse input, shape response)
                          ├─ service     (business logic, throws AppError)
                          ├─ lib         password · tokens · jwt · mailer
                          └─ models ──> MongoDB (users · verificationtokens · refreshtokens)
                    mailer ──SMTP──> Mailpit (dev) / provider (prod)
```

## Layering

Each feature is a **module** under `src/modules/<name>/` with a strict separation:

| File | Responsibility | Rules |
| --- | --- | --- |
| `validators.ts` | Zod schemas + inferred types | The only place request shapes are defined |
| `service.ts` | Business logic, DB access | Throws `AppError`; no Express types |
| `controller.ts` | Express handlers | Parse with a validator → call service → respond; thin |
| `routes.ts` | `Router` wiring + per-route middleware | Mounted in `app.ts` |

Shared concerns live outside modules: `lib/` (pure helpers), `middleware/`
(cross-cutting Express), `models/` (Mongoose schemas), `config/` (env), `db/`
(connection).

## Error handling

`errorHandler` is the single Express error middleware. Because Express 5 forwards
both synchronous throws and rejected promises from handlers, route code never
needs try/catch — it just throws:

- `ZodError` → `400 { error: { code: "VALIDATION_ERROR", details } }`
- `AppError` → `status { error: { code, message } }`
- anything else → `500 { error: { code: "INTERNAL" } }` (logged at `error`)

## Registration + verification flow

```
POST /auth/register {email,password}
  └─ service.register
       ├─ new user?      → hash password (argon2id), create user(emailVerified:false), issue token
       ├─ exists+unverified → re-issue token
       └─ exists+verified   → no-op
     (always) → 202 generic response  (no account enumeration)
  └─ issueVerification → store sha256(token) w/ 24h TTL, email raw token link via Mailpit

GET /auth/verify?token=…
  └─ hash token → find unconsumed, unexpired → set emailVerified, stamp consumedAt → 302 → CLIENT_URL
```

## Login + token rotation flow

```
POST /auth/login {email,password}
  └─ verify password (argon2) → require emailVerified → issue:
       • access JWT (HS256, sub=userId, 15m) → response body
       • refresh token (random, sha256-stored, family id) → httpOnly cookie, path /auth

POST /auth/refresh   (refresh cookie)
  └─ look up by hash
       ├─ revoked?  → REUSE: revoke entire family → 401
       ├─ expired?  → 401
       └─ valid     → rotate (revoke old, mint new in same family) → new access + cookie

POST /auth/logout    (refresh cookie) → revoke current token → clear cookie → 204
```

Access requests carry `Authorization: Bearer <jwt>`; `requireAuth` verifies it and
sets `req.userId`.

## Preferences

Preferences are an **embedded subdocument** on the `User` (1:1, atomic, no join).
`PUT /me/preferences` builds a dotted `$set` so only supplied keys change. See
[data-model.md](data-model.md).

## Resilience

`db/connect.ts` retries the initial connection (10×, 3s apart, 5s server-selection
timeout) instead of exiting on first failure. In Docker, `app` additionally waits
on a Mongo **healthcheck** (`depends_on: condition: service_healthy`). Together:
the app starts only once Mongo is ready, and survives a brief Mongo outage.
