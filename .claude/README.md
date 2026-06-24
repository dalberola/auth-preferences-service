# Claude Code config for auth-preferences-service

Project-scoped helpers for [Claude Code](https://claude.com/claude-code),
committed so every contributor and agent shares the same workflows. New agents:
start with [`/onboard`](commands/onboard.md) and the root
[CLAUDE.md](../CLAUDE.md).

## Slash-command skills (`commands/`)

Invoke as `/<name> [argument]`.

| Command | Argument | What it does |
| --- | --- | --- |
| `/onboard` | `quick` \| `full` (default `full`) | Guided walkthrough: orient → run → exercise → verify. |
| `/dev` | `up` \| `down` \| `restart` \| `rebuild` | Start/stop the Docker dev stack (app + mariadb + mailpit). |
| `/test` | optional Vitest pattern | Run the Vitest suite (against a real MariaDB). |
| `/lint` | `check` \| `fix` | ESLint (flat config); keep at 0 problems. |
| `/verify` | `host` \| `docker` | Full gate: typecheck + lint + test. Run before "done". |
| `/logs` | optional service | Show & diagnose stack logs (disk-full, startup failures). |
| `/db-shell` | optional SQL | Query the dev MariaDB via the `mariadb` client (`auth_preferences`). |
| `/mailpit` | `open` \| `latest` | Inspect captured verification emails / pull the link. |
| `/new-endpoint` | module name | Scaffold a `validators/service/controller/routes` module. |
| `/reset-db` | — | Drop the dev database (destructive; confirms first). |
| `/triage` | intent (list/new/close/milestone) | Manage GitHub issues & milestones. |
| `/ci` | run id \| `watch` | Check GitHub Actions CI status; surface failures. |
| `/release` | semver version | Version bump + changelog + tag + GitHub release. |

## Conventions worth knowing

- **Verify every change** with `/verify` — `npm run typecheck && npm run lint &&
  npm test`. Vitest does not type-check, so `typecheck` is separate.
- **Module pattern**: one folder per HTTP feature under `src/modules/`, mounted in
  `app.ts`. Controllers are thin; logic + DB live in the service; request shapes
  live in `validators.ts`. Throw `AppError`; `errorHandler` maps it to JSON.
- **ESM/NodeNext**: relative imports use `.js` extensions.
- **Secrets** in `.env.local` (git-ignored). Precedence `process.env` >
  `.env.local` > `.env`.
- **Docker gotcha**: a green `docker compose ps` doesn't mean the app is
  listening (`tsx watch` stays up after a crash) — confirm with `/health`.

- **GitHub is the source of truth** for planning: issues + milestones + tags +
  Actions. Keep them updated as work lands; see
  [../docs/project-management.md](../docs/project-management.md). CI must be green
  before merging to `main`.

See [../docs/](../docs/) for architecture, API, data model, configuration,
development, security, and project-management references.
