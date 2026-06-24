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
  issue rather than expanding silently. Label it (`enhancement`, `bug`,
  `security`, `ci`, `tech-debt`, `documentation`) and assign a milestone.
- **Milestones are versions** (e.g. `v0.2.0`, `v1.0.0`). An issue without a target
  version stays unmilestoned (backlog).
- **CI must be green** before merging to `main`. The pipeline runs
  `typecheck → lint → test` against a MongoDB service container.
- **Releases**: bump the version, move `CHANGELOG [Unreleased]` into a dated
  section, tag `vX.Y.Z`, and publish a GitHub release. Close the milestone.
- **Closing the loop**: when work lands, reference and close its issue (e.g.
  `Closes #12` in the commit/PR) and update the milestone.

## Agent workflow

Agents use the Claude Code skills to operate these tools:

- `/triage` — list / create / update issues and milestones.
- `/ci` — check the latest GitHub Actions run and surface failures.
- `/release` — version bump + changelog + tag + GitHub release.

See [.claude/README.md](../.claude/README.md) for the full skill list.
