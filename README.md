# rootstock

A yard task planner. Every task cites the rule and the reading that produced it.

## Configuration

The build reads `ROOTSTOCK_AWAY_SLUG`, the path segment the Away Card is served at. The deploy workflow takes it from a repository secret of the same name. No committed file carries it, because this repository is public and a committed slug is a published one. A build without the variable fails on purpose, since the alternative is a default slug anyone could guess.

## Daily Run

`scripts/daily-run.sh` fetches the Observations, runs the Planner, narrates what came out, commits the Artifact and the status record, and pushes. The push is what rebuilds the site. It runs on cron, on a box that holds the coordinates and the credentials. `docs/operations/daily-run.md` has the crontab line, the environment that box needs, and how to fix an expired credential.
