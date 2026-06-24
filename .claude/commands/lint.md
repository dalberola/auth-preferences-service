Lint the source with ESLint (flat config, `eslint.config.js`).

Optional argument: `check` (default) or `fix`.

Mode: $ARGUMENTS

## Steps

- `check` (default) → `npm run lint`
- `fix` → `npx eslint . --fix`, then report what changed.

Config is `@eslint/js` recommended + `typescript-eslint` recommended, with
`no-unused-vars` as a warning that ignores `_`-prefixed names. Keep the tree at
**0 problems**. If `node_modules/` is missing, `npm install` first.
