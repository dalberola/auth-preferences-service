# Data model

MongoDB via Mongoose 9. Three collections. Tokens are always stored **hashed**.

## `users`

| Field | Type | Notes |
| --- | --- | --- |
| `email` | string | required, unique, lowercased, trimmed, indexed |
| `passwordHash` | string | argon2id hash; never the plaintext |
| `emailVerified` | boolean | default `false` |
| `preferences` | subdoc | embedded (1:1) — see below |
| `createdAt`/`updatedAt` | Date | `timestamps: true` |

### `preferences` subdocument

| Field | Type | Default |
| --- | --- | --- |
| `theme` | `"light" \| "dark" \| "system"` | `"system"` |
| `locale` | string | `"en"` |
| `schemaVersion` | number | `1` (bump when the shape changes) |
| `settings` | Mixed | `{}` — free-form, app-owned bag; validated at the API edge |

Embedded because it is strictly 1:1, needs atomic updates, and never queried
independently. Split into its own collection only if it grows large or needs
history/versioning.

## `verificationtokens`

| Field | Type | Notes |
| --- | --- | --- |
| `userId` | ObjectId → User | indexed |
| `tokenHash` | string | `sha256(rawToken)`, unique |
| `type` | `"email_verify"` | reserved for future `"password_reset"` |
| `expiresAt` | Date | **TTL index** (`expireAfterSeconds: 0`) → auto-deleted |
| `consumedAt` | Date \| null | set on use (single-use) |

## `refreshtokens`

| Field | Type | Notes |
| --- | --- | --- |
| `userId` | ObjectId → User | indexed |
| `tokenHash` | string | `sha256(rawToken)`, unique |
| `family` | string | rotation lineage; a reused token revokes the whole family |
| `expiresAt` | Date | **TTL index** → auto-deleted |
| `revokedAt` | Date \| null | set on rotation/logout/reuse |
| `replacedByHash` | string \| null | points at the rotated successor |

## Indexes summary

- `users.email` unique
- `verificationtokens.tokenHash` unique · `expiresAt` TTL
- `refreshtokens.tokenHash` unique · `userId`, `family` · `expiresAt` TTL

TTL indexes mean expired tokens are reaped by MongoDB automatically; no cron
needed.
