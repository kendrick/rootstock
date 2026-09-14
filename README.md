# rootstock

A yard task planner. Every task cites the rule and the reading that produced it.

## Configuration

The build reads `ROOTSTOCK_AWAY_SLUG`, the path segment the Away Card is served at. The deploy workflow takes it from a repository secret of the same name. No committed file carries it, because this repository is public and a committed slug is a published one. A build without the variable fails on purpose, since the alternative is a default slug anyone could guess.

## Daily Run

`scripts/daily-run.sh` fetches the Observations, runs the Planner, narrates what came out, commits the Artifact and the status record, and pushes. The push is what rebuilds the site. It runs on cron, on a box that holds the coordinates and the credentials. `docs/operations/daily-run.md` has the crontab line, the environment that box needs, and how to fix an expired credential.

## Test Coverage

`pnpm test` runs Vitest with coverage on every invocation; there's no separate command or flag. The v8 provider excludes `src/app/**`, which the Playwright suite exercises end to end, and `src/components/ui/**`, generated shadcn source this repo didn't write. Excluding both keeps the figure describing the planner and schema instead of being diluted by routing, layout, or vendored components.

The figure only covers what the test run actually loads. `vitest.config.ts` sets no `coverage.include`, so Vitest never scans the source tree for files nothing touched. A module no spec imports, directly or transitively, is left out of the figure entirely rather than counted as zero. The figure says how well the reached code is tested, not what share of the codebase has a test. Playwright specs under `tests/integration/` run through a separate test runner and never touch it.

Run `pnpm test` and read the printed table for the current numbers. It collapses any file already at 100%, so check `coverage/coverage-summary.json` (gitignored, regenerated on every run) for the per-file detail.
