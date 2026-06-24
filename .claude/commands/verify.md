Run the full verification gate: typecheck + lint + tests. Use before calling any
change done.

No argument.

Mode: $ARGUMENTS

## Why all three

Vitest (esbuild) does not type-check, so `typecheck` must run separately. Lint
keeps the tree at 0 problems. Tests prove the end-to-end flow.

## Steps

Tests always run against a real MariaDB. Ensure the compose stack is up (`/dev`);
`test/setup.ts` defaults `DB_*` to that stack (`127.0.0.1:3306`, `root`/`root`,
database `auth_preferences_test`), so the bare gate works:

```bash
npm run typecheck && npm run lint && npm test
```

If your MariaDB differs, export the overrides first (so they reach `npm test`,
not just the first command): `export DB_HOST=… DB_PORT=… DB_USER=… DB_PASSWORD=…`.

Report each stage's result. All three must pass.
