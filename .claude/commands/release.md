Cut a release: version bump → changelog → tag → GitHub release → close milestone.

Argument: the semver version, e.g. `0.2.0` (no leading `v`).

Version: $ARGUMENTS

Only release from `main` with a clean tree and **green CI** (`/ci`).

## Steps

1. Preconditions: on `main`, `git status` clean, `/verify` passes, `/ci` green.
2. Bump `version` in `package.json` to the target (and `package-lock.json` via
   `npm version <version> --no-git-tag-version`).
3. Update `CHANGELOG.md`: rename `[Unreleased]` to `[<version>] - <YYYY-MM-DD>`
   (use today's date), add a fresh empty `[Unreleased]`, and update the compare
   links at the bottom.
4. Commit: `git commit -am "release: v<version>"`.
5. Tag + push:
   ```bash
   git tag -a v<version> -m "v<version>"
   git push origin main --follow-tags
   ```
6. GitHub release (notes from the changelog section):
   ```bash
   gh release create v<version> --title "v<version>" --notes "<changelog body>"
   ```
7. Close the matching milestone:
   ```bash
   gh api repos/dalberola/auth-preferences-service/milestones --jq '.[]|select(.title=="v<version>").number'
   gh api -X PATCH repos/dalberola/auth-preferences-service/milestones/<number> -f state=closed
   ```

Report the release URL and confirm the tag is on the remote.
