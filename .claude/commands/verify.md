Run the full verification gate: typecheck + lint + tests. Use before calling any
change done.

Optional argument: `host` (default, if Node is available locally) or `docker`.

Mode: $ARGUMENTS

## Why all three

Vitest (esbuild) does not type-check, so `typecheck` must run separately. Lint
keeps the tree at 0 problems. Tests prove the end-to-end flow.

## Steps

- **host** (macOS, in-memory Mongo auto-downloaded):
  ```bash
  npm run typecheck && npm run lint && npm test
  ```

- **docker** (arm64 Linux can't fetch the in-memory binary — use the compose Mongo).
  Ensure the stack is up (`/dev`), then:
  ```bash
  docker run --rm --network auth-preferences-service_default \
    -e MONGODB_TEST_URI=mongodb://mongo:27017/test \
    -v "$PWD":/app -w /app node:24-slim \
    sh -c "npm install && npm run typecheck && npm run lint && npm test"
  ```

Report each stage's result. All three must pass.
