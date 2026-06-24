Check the GitHub Actions CI status and surface any failures.

Optional argument: a run id, or `watch` to follow the in-progress run. If empty,
show the latest run on `main`.

Target: $ARGUMENTS

CI is `.github/workflows/ci.yml`: `typecheck → lint → test` against a MongoDB
service container (tests use `MONGODB_TEST_URI`). It runs on pushes and PRs to
`main`.

## Steps

1. Latest runs: `gh run list --workflow ci.yml --limit 5`.
2. Inspect a run: `gh run view <id>` (add `--log-failed` to see only failed steps).
3. Follow in progress: `gh run watch <id>`.
4. If a step failed, read the failed log, reproduce locally with `/verify`, fix,
   and push. Do not merge to `main` with red CI.

Report the conclusion (success/failure), which step failed, and the root cause.
