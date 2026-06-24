# Development

Dev runs in Docker: `app` (tsx watch) + `mongo` + `mailpit`.

## Start

```bash
cp .env.example .env.local      # set the two JWT secrets
docker compose up --build
```

| Service | URL | Notes |
| --- | --- | --- |
| API | http://localhost:4000 | `GET /health` |
| Mailpit | http://localhost:8025 | catches verification emails |
| MongoDB | mongodb://localhost:27017 | data in the `mongo_data` volume |

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

## Testing

The suite is a full end-to-end pass over register → verify → login → preferences
→ refresh, with the mailer mocked to capture the token.

- **Host (macOS arm64):** `npm test` — `mongodb-memory-server` downloads the
  matching binary automatically.
- **Container:** set `MONGODB_TEST_URI` to a real Mongo and no binary is needed:

```bash
docker run --rm --network auth-preferences-service_default \
  -e MONGODB_TEST_URI=mongodb://mongo:27017/test \
  -v "$PWD":/app -w /app node:24-slim \
  sh -c "npm install && npm test"
```

The full verification gate (`typecheck && lint && test`) is wrapped by the
`/verify` skill.

## Troubleshooting

### Mongo crash-loops with `exit 100` / `No space left on device`
The Docker VM's virtual disk is full (not your host disk). Mongo can't create
`/data/db/journal`. Reclaim space — build cache is safe to drop:

```bash
docker system df              # see what's consuming space
docker builder prune -af      # frees all inactive build cache
docker compose up -d          # then restart; may also need: docker compose restart app
```

### `docker compose ps` shows `app` Up but nothing answers on :4000
`tsx watch` keeps the container alive even after the Node process exits (e.g. a
failed startup). Check `docker compose logs app` and `curl localhost:4000/health`.
After fixing the cause, `docker compose restart app`.

### Tests 403 on `mongodb-memory-server` download
You're on arm64 Linux, which has no published in-memory binary. Use the
`MONGODB_TEST_URI` approach above.

### `app` exits before Mongo is ready
It shouldn't — `connect.ts` retries (10×/3s) and compose gates on a Mongo
healthcheck. If it still gives up, Mongo is down for > ~30s; check `mongo` logs.
