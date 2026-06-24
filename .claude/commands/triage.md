List, create, and update GitHub issues and milestones for this project.

Optional argument: a free-text intent, e.g. `list open`, `new: <title>`,
`close 12`, `milestone v0.2.0`. If empty, show the current open issues grouped by
milestone.

Intent: $ARGUMENTS

This project is tracked on GitHub as the source of truth (see
[docs/project-management.md](../../docs/project-management.md)). You are authorized
to manipulate issues and milestones via `gh`.

## Steps

1. **Show state** (default): 
   ```bash
   gh issue list --state open
   gh api repos/dalberola/auth-preferences-service/milestones --jq '.[]|{title,open:.open_issues,closed:.closed_issues}'
   ```
2. **Create an issue**: write a clear title + body (problem, acceptance criteria),
   label it, and assign a milestone:
   ```bash
   gh issue create --title "<title>" --body "<body>" --label <label> --milestone "<vX.Y.Z>"
   ```
   Labels in use: `enhancement`, `bug`, `security`, `ci`, `tech-debt`,
   `documentation`. Create missing labels with `gh label create`.
3. **Create a milestone** (no native `gh` verb — use the API):
   ```bash
   gh api repos/dalberola/auth-preferences-service/milestones -f title="vX.Y.Z" -f description="…"
   ```
4. **Update / close**: `gh issue edit <n> --add-label … --milestone …` /
   `gh issue close <n> --comment "…"`.

Keep `docs/` and `CHANGELOG.md` consistent when scope changes. Prefer closing
issues from commits/PRs with `Closes #<n>`.
