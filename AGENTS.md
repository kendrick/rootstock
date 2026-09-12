# rootstock

## Agent skills

### Issue tracker

Issues and specs live as GitHub issues in `kendrick/rootstock`, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, each label string equal to its name. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Domain

Read `CONTEXT.md` before naming anything. The domain words are load-bearing: a Rule is not a Task, a Guard creates no work, an Occurrence is not a checkbox, and an Advisory is not a Citation. Each entry carries an `_Avoid_` line naming the synonyms that must not be used for it.

Decisions with consequences live in `docs/adr/`. Read the ones touching what you are about to change, and say so explicitly if your work contradicts one rather than quietly overriding it.

## Conventions the file tree does not show

Specs live beside the code they exercise, named for it: `rule.ts` and `rule.spec.ts` in the same directory. There is no separate unit-test tree. `src/validation/colocation.spec.ts` enforces this and fails by name on a spec with no subject beside it, so the rule holds without anyone remembering it. A spec that genuinely spans several modules goes in that file's exception map with a written reason.

`tests/integration/` is the one exception and is not a unit-test tree: it holds Playwright specs that drive the built static export rather than importing a module.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
