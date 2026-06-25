# Development

Dev runs in Docker: `app` (tsx watch) + `mariadb` + `mailpit`.

## Start

```bash
cp .env.example .env.local      # set the two JWT secrets
docker compose up --build
```

| Service | URL | Notes |
| --- | --- | --- |
| API | http://localhost:4000 | `GET /health` |
| Mailpit | http://localhost:8025 | catches verification emails |
| MariaDB | localhost:3306 | data in the `mariadb_data` volume |

The source is bind-mounted; `tsx watch` hot-reloads on host edits.

## Scripts

```bash
npm run dev        # tsx watch (the container's default command)
npm run build      # tsc -> dist/
npm start          # node dist/server.js
npm run typecheck  # tsc --noEmit  (Vitest does NOT type-check — run this too)
npm run lint       # eslint
npm test           # vitest
```

## Production image

`Dockerfile` is a multi-stage production build, distinct from `Dockerfile.dev`:

1. **build** — `npm ci` + `npm run build` (`tsc` → `dist/`).
2. **prod-deps** — `npm ci --omit=dev` for a dev-dependency-free `node_modules`
   (same glibc base as runtime, so the native `argon2` binary is compatible).
3. **runtime** — copies `dist/` + production `node_modules`, runs as the non-root
   `node` user, `NODE_ENV=production`, and `node dist/server.js`. A `HEALTHCHECK`
   polls `GET /health` via Node's global `fetch`.

```bash
docker build -t auth-preferences-service:prod .
```

`compose.prod.yml` runs the built image end-to-end against bundled MariaDB and
Mailpit (JWT secrets read from `.env.local`):

```bash
docker compose -f compose.prod.yml up --build
```

> **Schema:** `NODE_ENV=production` disables TypeORM's `synchronize`, so the prod
> image does **not** auto-create tables. Until migrations land
> ([#5](https://github.com/dalberola/auth-preferences-service/issues/5)) the schema
> must be created out-of-band. Real deployments supply their own managed MariaDB
> and SMTP via environment rather than the bundled services.

## Testing

The suite covers the end-to-end pass (register → verify → login → preferences →
refresh) plus the security-critical edges: refresh-token reuse detection and
family burn, logout revocation, partial-preference merge, validation errors, and
rate limiting (in a dedicated spec that runs outside `NODE_ENV=test`). The mailer
is mocked to capture the verification token.

Tests always run against a real MariaDB. The harness (`test/setup.ts`) defaults
the `DB_*` vars to `127.0.0.1:3306` with database `auth_preferences_test`,
creates that database if absent, then drops and recreates its schema each run
(`NODE_ENV=test` ⇒ TypeORM `dropSchema`). With the compose stack up the defaults
match it, so the bare gate works:

```bash
npm run typecheck && npm run lint && npm test
```

If your MariaDB differs, `export DB_HOST=… DB_PORT=…` first — a
`VAR=… cmd1 && cmd2` prefix applies only to `cmd1`, and it's `npm test` that needs
the vars.

The full verification gate (`typecheck && lint && test`) is wrapped by the
`/verify` skill.

## Troubleshooting

### `mariadb` container fails / is unhealthy and the app keeps retrying
The app retries connecting to host `mariadb`; if it never goes healthy, check the
`mariadb` container. A common cause is a full Docker VM virtual disk (not your
host disk) — the DB container can't write its data. Reclaim space — build cache
is safe to drop:

```bash
docker system df              # see what's consuming space
docker builder prune -af      # frees all inactive build cache
docker compose up -d          # then restart; may also need: docker compose restart app
```

### `docker compose ps` shows `app` Up but nothing answers on :4000
`tsx watch` keeps the container alive even after the Node process exits (e.g. a
failed startup). Check `docker compose logs app` and `curl localhost:4000/health`.
After fixing the cause, `docker compose restart app`.

### `ERR_MODULE_NOT_FOUND` after changing dependencies
The app's anonymous `/app/node_modules` volume can shadow the rebuilt image and
hide newly installed modules. Rebuild and renew the anonymous volume:
`docker compose up --build --renew-anon-volumes`.

### `app` exits before the DB is ready
It shouldn't — `connect.ts` retries (10×/3s) and compose gates on a MariaDB
healthcheck. If it still gives up, check `mariadb` logs.
