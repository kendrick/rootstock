# rootstock

A yard task planner for one property in North Texas. It answers one question a day—what does the yard need this week, and why—and every Task it shows carries the Rule that produced it and the dated reading that fired that Rule. The Planner authors every Task. The model may select, order, and write prose, and it may not add a Task, remove one, or change a date.

Live at [kendrick.github.io/rootstock](https://kendrick.github.io/rootstock/).

- [What It Is and for Whom](#what-it-is-and-for-whom)
- [How a Run Works](#how-a-run-works)
- [Working with the Model Off](#working-with-the-model-off)
- [Commands](#commands)
- [Configuration](#configuration)
- [Testing, and What the Coverage Figure Covers](#testing-and-what-the-coverage-figure-covers)
- [Data Attribution](#data-attribution)
- [Decisions](#decisions)
- [Licence](#licence)

## What It Is and for Whom

Rules are stored as data rather than code: a fall pre-emergent window, a soil temperature that has to hold for a run of days, an interval since the last time someone did the thing. The Planner is a pure function that reads the inventory, the rule set, the Observations behind them and the Occurrence history, and returns a Plan for one date. Guards run afterwards and may defer or annotate a Task. No Guard can remove one, because a Task that disappears is indistinguishable from one nobody thought of.

The property is one yard, and the reader is whoever is standing in it. The rest of the household reads the Away Card instead, a printable, read-only list of the work that may be delegated, served at a slug no committed file carries and rendering the same way whether or not anyone is travelling.

The property that matters most is the one a screenshot cannot show: **the Planner is the only thing here that may create a Task.** Narration receives a finished Plan. Validation rejects any narration naming a rule ID the Plan did not contain, and a run that fails validation falls back to mechanical prose rather than publishing a lie. [ADR 0001](docs/adr/0001-the-planner-authors-every-task.md) has the full argument, including what the decision costs. The vocabulary above is exact, and [CONTEXT.md](CONTEXT.md) defines every term of it.

## How a Run Works

`scripts/daily-run.sh` is the whole pipeline. It fetches Observations from Open-Meteo, runs the Planner, narrates the finished Plan, writes `data/artifact.json` and `data/status.json`, commits both, and pushes. The push is the deploy. GitHub Pages already watches `main`, so there is no webhook to fire and no second generation running in CI. A failed run still commits its status record, which is how the site says so.

The site itself is a static export with no server runtime, so it makes no model call and no network fetch in the browser. The build bakes the committed Artifact in, and the page you load parses that JSON and renders it. The one figure computed at render time is Staleness, the Artifact's age, because a baked answer becomes a lie the moment the daily run stops.

Nothing runs `scripts/daily-run.sh` on a schedule yet. The script is proven end to end and the last run was by hand, so the published Artifact is only as fresh as the last time somebody ran it, which is what Staleness on the page reports. [docs/operations/daily-run.md](docs/operations/daily-run.md) says what runs today, and has the crontab line a box would use, the environment it needs, and what to do when the credential behind Narration expires.

The browser keeps one thing to itself. Ticking a Task writes an Occurrence to that browser's IndexedDB, and the daily run plans from the committed history in `src/seed/occurrences.json` alone, so a tick changes what that reader sees and never what the site publishes. [ADR 0006](docs/adr/0006-the-daily-run-plans-from-committed-history.md) has the argument and what it costs.

## Working with the Model Off

Turn Narration off and the Task list is identical. Only the prose changes, from written sentences to the terse mechanical ones the Planner already wrote into each `Task.title`, and the Artifact records which of the two it carries. Anyone can check that: switch the model off and diff the output.

It also means the whole application can be developed and shown with no model calls at all. `pnpm dev` reads the committed Artifact and needs no credential.

## Commands

Node 24 or newer and pnpm 10, pinned in `.nvmrc`, `engines`, and `packageManager`.

```bash
pnpm install      # install dependencies
pnpm dev          # dev server at http://localhost:3000/rootstock
pnpm test         # Vitest, with coverage on every run
pnpm test:e2e     # Playwright against the built static export
pnpm build        # static export to out/
```

The base path is `/rootstock` in development as well as in production, because the deployed site is a GitHub Pages project page rather than a user page. Before `pnpm build`, set `ROOTSTOCK_AWAY_SLUG`; the build fails without it. `pnpm test:e2e` builds first through its `pretest:e2e` hook, so it needs the same variable.

The rest, as you need them:

```bash
pnpm lint         # ESLint over the repo
pnpm lint:css     # Stylelint over the stylesheets
pnpm typecheck    # tsc --noEmit
pnpm generate     # one generation run: fetch, plan, narrate, write the Artifact
```

`pnpm generate` is the daily job without the git work around it. It reaches the network and the narrator, so it needs the location variables below and a working codex credential. Everything else runs from a clean checkout with nothing configured, `pnpm dev` included, though the dev server throws on the Away Card route until the slug is set.

## Configuration

Copy `.env.example` to `.env.local`, which is what Next reads and what `.gitignore` covers. Four variables matter to anyone running this, and `CODEX_HOME` belongs to the generation box:

| Variable              | What it is                                                                    |
| --------------------- | ----------------------------------------------------------------------------- |
| `ROOTSTOCK_LATITUDE`  | Property latitude, -90 to 90                                                  |
| `ROOTSTOCK_LONGITUDE` | Property longitude, -180 to 180                                               |
| `ROOTSTOCK_TIME_ZONE` | IANA zone, such as `America/Chicago`, used to bucket the Planner's local days |
| `ROOTSTOCK_AWAY_SLUG` | The path segment the Away Card is served at                                   |
| `CODEX_HOME`          | Where codex keeps the credentials Narration spends, usually `~/.codex`        |

No committed file carries a real value for any of them. The coordinates live in the generation environment and nowhere else. This repository is public, and GitHub Pages publishes a public site whatever the repository's own visibility is, so anything committed here is published permanently. [ADR 0004](docs/adr/0004-coordinates-never-enter-the-repository.md) works through that and the alternatives that looked better than they were.

The Away Card slug is the same problem in a different shape, since a committed slug is a published one. The deploy workflow takes it from a repository secret of the same name. A build without the variable fails on purpose, because the alternative is a default slug anyone could guess.

## Testing, and What the Coverage Figure Covers

`pnpm test` runs Vitest with coverage on every invocation; there is no separate command or flag. The v8 provider excludes three paths. `src/app/**` is routing and layout the Playwright suite exercises end to end. `src/components/ui/**` is generated shadcn source this repo did not write. `data/**` is the committed Artifact, which `load.ts` drags into the report at a free 100%, and a JSON file has no branch to miss. Excluding all three keeps the figure describing the planner and the schemas instead of being diluted by routing, layout, vendored components, or a file that cannot fail.

The figure only covers what the test run actually loads. `vitest.config.ts` sets no `coverage.include`, so Vitest never scans the source tree for files nothing touched. A module no spec imports, directly or transitively, is left out of the figure entirely rather than counted as zero. The figure says how well the reached code is tested, not what share of the codebase has a test. Playwright specs under `tests/integration/` run through a separate runner and never touch it.

Run `pnpm test` and read the printed table for the current numbers. It collapses any file already at 100%, so check `coverage/coverage-summary.json` (gitignored, regenerated on every run) for the per-file detail.

Specs sit beside the code they exercise: `rule.ts` and `rule.spec.ts` in the same directory, with no separate unit-test tree. `tests/integration/` is the one exception, and it holds Playwright specs that drive the built export rather than importing a module.

## Data Attribution

Weather data by [Open-Meteo.com](https://open-meteo.com/), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The site renders that attribution in the footer of every route.

## Decisions

Decisions with consequences live in [docs/adr/](docs/adr/), one file each, and each argues the alternative it rejected:

- [ADR 0001: the planner authors every task, and the model only chooses the words](docs/adr/0001-the-planner-authors-every-task.md)
- [ADR 0002: a guard holds a task back and says why, instead of removing it](docs/adr/0002-guards-defer-rather-than-delete.md)
- [ADR 0003: the artifact carries the readings the rules looked at](docs/adr/0003-the-artifact-ships-the-evaluated-window.md)
- [ADR 0004: exact coordinates live in the generation environment and nowhere else](docs/adr/0004-coordinates-never-enter-the-repository.md)
- [ADR 0005: a threshold rule says which way it crosses, and a crossing stays crossed](docs/adr/0005-a-threshold-crossing-names-its-direction.md)
- [ADR 0006: the daily run plans from committed history, so a browser tick stays in that browser](docs/adr/0006-the-daily-run-plans-from-committed-history.md)

## Licence

[MIT](LICENSE). Copyright (c) 2026 Kendrick Arnett.
