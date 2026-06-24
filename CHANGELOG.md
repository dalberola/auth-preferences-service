# Changelog

All notable changes to this project are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); versions are git tags +
[GitHub releases](https://github.com/dalberola/auth-preferences-service/releases).

## [Unreleased]

_Track in-flight work via [issues](https://github.com/dalberola/auth-preferences-service/issues)
and [milestones](https://github.com/dalberola/auth-preferences-service/milestones)._

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
