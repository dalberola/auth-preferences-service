Run the Vitest suite.

Optional argument: a Vitest name/path pattern to focus the run. If empty, run all.

Pattern: $ARGUMENTS

## How tests work

One end-to-end spec (`test/auth.test.ts`) drives register → verify → login →
preferences → refresh against MongoDB, with the mailer mocked to capture the raw
verification token. `test/setup.ts` sets env before any `src` module loads.

Mongo source depends on where you run:
- **Host (macOS arm64):** `mongodb-memory-server` downloads the binary → just run `npm test`.
- **Container (arm64 Linux):** no in-memory binary exists; point at a real Mongo
  via `MONGODB_TEST_URI` (the harness uses it when set and skips the download).

## Steps

- Host, all tests → `npm test`
- Host, focused → `npm test -- <pattern>`
- In a container against the running compose Mongo:
  ```bash
  docker run --rm --network auth-preferences-service_default \
    -e MONGODB_TEST_URI=mongodb://mongo:27017/test \
    -v "$PWD":/app -w /app node:24-slim sh -c "npm install && npm test"
  ```

Vitest uses esbuild and does **not** type-check — run `/verify` (or `npm run
typecheck`) separately. Report pass/fail counts and any failure output.
