Run the Vitest suite.

Optional argument: a Vitest name/path pattern to focus the run. If empty, run all.

Pattern: $ARGUMENTS

## How tests work

One end-to-end spec (`test/auth.test.ts`) drives register → verify → login →
preferences → refresh against MariaDB, with the mailer mocked to capture the raw
verification token. `test/setup.ts` sets env before any `src` module loads.

Tests always run against a real MariaDB. The harness defaults the `DB_*` vars to
`127.0.0.1:3306` with database `auth_preferences_test`, creates that database if
absent, then drops and recreates its schema each run (`NODE_ENV=test` ⇒ TypeORM
`dropSchema`). Bring the compose stack up first (`/dev`).

## Steps

- All tests → `DB_HOST=127.0.0.1 DB_PORT=3306 DB_USER=root DB_PASSWORD=root npm test`
- Focused → `DB_HOST=127.0.0.1 DB_PORT=3306 DB_USER=root DB_PASSWORD=root npm test -- <pattern>`

Vitest uses esbuild and does **not** type-check — run `/verify` (or `npm run
typecheck`) separately. Report pass/fail counts and any failure output.
