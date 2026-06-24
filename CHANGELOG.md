# Changelog

All notable changes to this project are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); versions are git tags +
[GitHub releases](https://github.com/dalberola/auth-preferences-service/releases).

## [Unreleased]

_Track in-flight work via [issues](https://github.com/dalberola/auth-preferences-service/issues)
and [milestones](https://github.com/dalberola/auth-preferences-service/milestones)._

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
- Background **token reaper** (`src/db/reaper.ts`) deleting expired refresh and
  verification tokens on an interval (`REAP_INTERVAL_MINUTES`, default 60),
  replacing MongoDB's TTL index ([#7](https://github.com/dalberola/auth-preferences-service/issues/7)).
  Reaps by expiry only, so revoked-but-unexpired refresh tokens are retained for
  reuse detection.

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

[Unreleased]: https://github.com/dalberola/auth-preferences-service/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/dalberola/auth-preferences-service/releases/tag/v0.1.0
