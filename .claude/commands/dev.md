Start (or restart) the local Docker dev stack: app + mariadb + mailpit.

Optional argument: `up` (default), `down`, `restart`, or `rebuild`.

Action: $ARGUMENTS

## Steps

1. Ensure `.env.local` exists with the two JWT secrets set. If missing:
   `cp .env.example .env.local` and tell the user to set `JWT_ACCESS_SECRET` and
   `JWT_REFRESH_SECRET` (`openssl rand -hex 32`, two different values ≥ 32 chars).
2. Run the requested action from the repo root:
   - `up` (default) → `docker compose up -d` (add `--build` if the image is stale)
   - `restart` → `docker compose restart app`
   - `rebuild` → `docker compose up -d --build`
   - `down` → `docker compose down` (add `-v` only if the user wants to wipe data)
3. Wait until the app logs `listening on http://localhost:4000`, then verify with
   `curl -s localhost:4000/health` (expect `{"status":"ok"}`).
4. Report URLs: API http://localhost:4000 · Mailpit http://localhost:8025.

Note: a green `docker compose ps` does NOT prove the server is listening — `tsx
watch` keeps the container Up even if startup failed. Always confirm via `/health`.
If `mariadb` is unhealthy, run `/logs` to diagnose (often a full Docker disk).
