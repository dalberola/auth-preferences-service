# Data model

MariaDB via TypeORM 1.0 (mysql2 driver). Three tables. Tokens are always stored
**hashed**. Primary keys are UUIDs (`@PrimaryGeneratedColumn("uuid")`) so IDs stay
opaque strings — the API contract is unchanged from the MongoDB era.

## `users`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | char(36) UUID | primary key |
| `email` | varchar(320) | unique index; stored lowercased by the service |
| `passwordHash` | varchar(255) | argon2id hash; never the plaintext |
| `emailVerified` | boolean | default `false` |
| `preferences` | json | embedded 1:1 settings — see below |
| `createdAt`/`updatedAt` | datetime | `@CreateDateColumn`/`@UpdateDateColumn` |

### `preferences` JSON column

| Field | Type | Default |
| --- | --- | --- |
| `theme` | `"light" \| "dark" \| "system"` | `"system"` |
| `locale` | string | `"en"` |
| `schemaVersion` | number | `1` (bump when the shape changes) |
| `settings` | object | `{}` — free-form, app-owned bag; validated at the API edge |
| `updatedAt` | number | `0` — settings-blob clock (epoch-ms); optimistic-concurrency token |

A single `json` column (MariaDB has no embedded-document type). Partial updates
are **read-merge-save** in `preferences/service.ts` — the whole object is rewritten,
which is fine at this scale. The default object is set in code on insert
(`defaultPreferences()`), not via a column default.

`updatedAt` lives **inside** the JSON blob, so adding it needs no migration. It is
the edit time a client stamps when writing `settings`; `PUT` refuses a value older
than the stored one with `409 PREFERENCES_CONFLICT` (optimistic concurrency), which
is how two devices sharing an account avoid silently clobbering each other —
last-writer-by-edit-time wins. Existing rows predating this field read as `0` and are
superseded by the first timestamped write.

## `verification_tokens`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | char(36) UUID | primary key |
| `userId` | char(36) | index → `users.id` (plain column, no ORM relation) |
| `tokenHash` | varchar(255) | `sha256(rawToken)` hex (64 chars), unique |
| `type` | varchar(32) | `"email_verify"` (reserved for future `"password_reset"`) |
| `expiresAt` | datetime | enforced in app code (no TTL — see below) |
| `consumedAt` | datetime \| null | set on use (single-use) |
| `createdAt` | datetime | |

## `refresh_tokens`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | char(36) UUID | primary key |
| `userId` | char(36) | index → `users.id` |
| `tokenHash` | varchar(255) | `sha256(rawToken)` hex, unique |
| `family` | char(36) | rotation lineage (UUID); a reused token revokes the whole family |
| `expiresAt` | datetime | enforced in app code (no TTL) |
| `revokedAt` | datetime \| null | set on rotation/logout/reuse |
| `replacedByHash` | varchar(255) \| null | points at the rotated successor |
| `createdAt` | datetime | |

## Indexes summary

- `users.email` unique
- `verification_tokens.tokenHash` unique · `userId`
- `refresh_tokens.tokenHash` unique · `userId`, `family`

## Token reaping

MariaDB has **no TTL index** (a MongoDB feature), so a background reaper
(`src/db/reaper.ts`) deletes rows where `expiresAt < now`. It is started in
`server.ts` and runs once on boot, then every `REAP_INTERVAL_MINUTES` (default
60). Reaping is keyed on **expiry only**: a revoked-but-unexpired refresh token is
kept on purpose, so a replay is still detected as reuse and burns its family
(deleting it early would weaken reuse detection to a plain invalid-token). Expiry
is independently enforced in application code, so the reaper is hygiene, not
correctness.

The same reaper tick also enforces the **inactivity policy** (Privacy Policy):
`users.lastActiveAt` is refreshed on every login **and** token refresh, and
accounts idle longer than `INACTIVITY_PURGE_MONTHS` (default 12) are deleted with
their tokens. `INACTIVITY_WARNING_DAYS` (default 30) before the cutoff a warning
email is sent once, tracked by `users.inactivityWarnedAt` (cleared when the user
becomes active again).

## Schema management

`synchronize: true` outside production keeps the schema in sync with the entities
automatically (dev + tests). Production will use TypeORM migrations instead
(`synchronize: false`), tracked with the production-hardening work (#4/#5). Tests
run with `dropSchema: true` for a clean schema each run.
