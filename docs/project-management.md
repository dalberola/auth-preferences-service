# Project management

This project is tracked on **GitHub** as the source of truth. Issues, milestones,
tags/releases, and Actions are maintained alongside the code (by maintainers and
by AI agents authorized to operate these tools).

## Where things live

| Concern | Home |
| --- | --- |
| Planned & in-flight work | [Issues](https://github.com/dalberola/auth-preferences-service/issues) |
| Version scope / grouping | [Milestones](https://github.com/dalberola/auth-preferences-service/milestones) |
| Releases | git tags + [Releases](https://github.com/dalberola/auth-preferences-service/releases) |
| History of changes | [CHANGELOG.md](../CHANGELOG.md) |
| Continuous integration | [Actions](https://github.com/dalberola/auth-preferences-service/actions) (`.github/workflows/ci.yml`) |

## Conventions

- **Every non-trivial change is an issue.** New scope discovered mid-work → open an
  issue rather than expanding silently. Give it a **type** label (`enhancement`,
  `bug`, `security`, `ci`, `tech-debt`, `documentation`, `breaking`, `uncertainty`)
  and a **lane** (see below). Assign a **milestone** once it is scheduled.
- **Milestones are versions** (e.g. `v0.2.0`, `v1.0.0`). Unscheduled work has no
  milestone and lives in `lane:backlog`.
- **CI must be green** before merging to `main`. The pipeline runs
  `typecheck → lint → test` against a MariaDB service container.
- **Releases**: bump the version, move `CHANGELOG [Unreleased]` into a dated
  section, tag `vX.Y.Z`, and publish a GitHub release. Close the milestone.
- **Closing the loop**: when work lands, reference and close its issue (e.g.
  `Closes #12` in the commit/PR) and update the milestone.

## Workflow lanes

Every issue carries exactly one `lane:*` label marking its state. Lanes move
left-to-right; a new issue enters at triage or backlog.

| Lane | Meaning |
| --- | --- |
| `lane:backlog` | Deferred idea, not scheduled. No milestone yet. |
| `lane:needs-triage` | Newly opened, not yet sorted (set automatically — see below). |
| `lane:ready` | Triaged and scheduled (has a milestone); ready to start. |
| `lane:in-progress` | Actively being worked. |
| `lane:needs-verification` | Claimed done **or** an uncertainty raised while coding; **stays open until verified**. |
| `lane:blocked` | Waiting on a dependency or a decision. |

Lanes are labels (not a board) so they work with repo permissions and filter via
issue search, e.g. [`label:lane:backlog`](https://github.com/dalberola/auth-preferences-service/issues?q=is%3Aissue+is%3Aopen+label%3Alane%3Abacklog).
A visual board can be layered on later (GitHub Project, same labels as fields).

**Action items** are GitHub task-list checkboxes (`- [ ]`) inside an issue. A
multi-step plan is a tracking issue whose checkboxes are its action items; promote a
checkbox to its own issue when it grows.

## Processes

These are binding for maintainers and agents:

- **Capture an uncertainty.** While coding, anything unverified — an assumption, a
  "is this still true?", a suspected bug you can't confirm now — becomes an issue
  labelled `uncertainty` + `lane:needs-verification`. It **stays open until
  verified**; do not rely on the assumption until it is closed with evidence.
- **Plan an execution.** Before starting scheduled work, give it a home first:
  a **milestone** (the version it ships in) and/or an **issue**/**action item**.
  Move the issue to `lane:ready`, then `lane:in-progress` when you pick it up.
- **Defer an idea.** Not doing it now → open an issue in `lane:backlog` (no
  milestone). The backlog lane is the single home for "later"; the README and docs
  link to it rather than duplicating lists.
- **Close the loop.** A PR that lands the work closes its issue (`Closes #n`). If the
  result is asserted but not yet proven, leave it in `lane:needs-verification` until
  verified, then close.

## Automation

`.github/workflows/triage.yml` labels any issue opened without a `lane:*` label as
`lane:needs-triage`, so nothing falls through. Issues created already in a lane are
left untouched.

## Agent workflow

Agents use the Claude Code skills to operate these tools:

- `/triage` — list / create / update issues and milestones.
- `/ci` — check the latest GitHub Actions run and surface failures.
- `/release` — version bump + changelog + tag + GitHub release.

See [.claude/README.md](../.claude/README.md) for the full skill list.
