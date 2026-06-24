Onboard yourself (an AI agent) or a new contributor to this repo: build an
accurate mental model, get the stack running, and prove it works — end to end.

Optional argument: `quick` (orient only, no stack startup) or `full` (default —
includes running and exercising the stack).

Mode: $ARGUMENTS

Work through the phases in order. Narrate findings concisely; don't dump file
contents. Stop and ask if anything contradicts what's documented.

## Phase 1 — Orient (always)

1. Read [CLAUDE.md](../../CLAUDE.md) — the agent context and gotchas. This is the
   source of truth for conventions.
2. Skim [docs/architecture.md](../../docs/architecture.md) and
   [docs/data-model.md](../../docs/data-model.md) to learn the module layering and
   the three collections.
3. Map the code to the docs: list `src/modules/*`, open one module
   (`auth` or `preferences`) and trace `routes → controller → service → model`.
4. Note the toolchain from `package.json` (Node 24, TS 6, Express 5, Vitest 4)
   and that imports use `.js` extensions (NodeNext/ESM).

Summarize in 5–8 bullets: what the service does, the module pattern, the auth
model (access JWT + rotating refresh cookie), and the top 3 gotchas.

## Phase 2 — Stand it up  (skip if `quick`)

1. `/dev up` — ensure `.env.local` exists with JWT secrets, then `docker compose
   up -d`. Wait for `listening on http://localhost:4000`.
2. `curl -s localhost:4000/health` → expect `{"status":"ok"}`.
3. If anything is unhealthy, use `/logs` to diagnose (most likely: full Docker
   disk → `docker builder prune -af`).

## Phase 3 — Exercise the core flow  (skip if `quick`)

Prove the whole spine works against the live stack:

1. Register: `POST /auth/register` with a test email + a ≥12-char password → 202.
2. Grab the verification link from Mailpit (`/mailpit latest`), then `GET` it → 302.
3. Login: `POST /auth/login` (save cookies) → `{accessToken}` + refresh cookie.
4. Preferences: `PUT /me/preferences` with the bearer token, then `GET` it back.
5. Refresh: `POST /auth/refresh` with the cookie → a new access token.

Report each step's status code. See [docs/api.md](../../docs/api.md) for exact
shapes and ready-made curl commands.

## Phase 4 — Prove the gate  (skip if `quick`)

Run `/verify` (typecheck + lint + tests) and confirm all three pass. You are now
oriented and have a working, verified environment.

## Output

Finish with: (a) the orientation summary, (b) stack status + `/health` result,
(c) the flow results, (d) the verify result, and (e) anything that surprised you
or looks worth fixing.
