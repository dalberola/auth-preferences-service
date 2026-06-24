Show and diagnose service logs from the Docker dev stack.

Optional argument: a service name (`app`, `mongo`, `mailpit`) or empty for all.

Service: $ARGUMENTS

## Steps

1. `docker compose ps` — note any service that is `Restarting`, `Exited`, or
   unhealthy.
2. Tail logs: `docker compose logs <service> --no-color --tail 50` (or all
   services if no argument).
3. Diagnose common failures:
   - **mongo `Restarting (100)` / `No space left on device` / cannot create
     `/data/db/journal`** → Docker VM disk is full. Run `docker system df`; fix
     with `docker builder prune -af`, then `docker compose up -d` (and likely
     `docker compose restart app`). Confirm the prune scope with the user first.
   - **app `getaddrinfo ENOTFOUND mongo` / `failed to start server`** → Mongo is
     down; fix Mongo first. The app retries on startup, so once Mongo is healthy
     it should self-heal; if not, `docker compose restart app`.
   - **app Up but `/health` unreachable** → `tsx watch` is alive but the Node
     process exited. Read the log for the real error, fix, then restart `app`.

Report the root cause and the exact remediation; don't run destructive Docker
commands (prune/down -v) without explicit confirmation.
