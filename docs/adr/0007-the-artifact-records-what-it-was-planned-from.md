# The Artifact records what it was planned from, and the site says when that has moved

The Artifact carries `plannedFrom`, a fingerprint of the Rules, Plants, Occurrences and tag policy the Planner read. Every page compares it with a fingerprint of the seed that page was built from. When the two differ, the page says the records changed after this plan was made. The daily run's check for "today already has a plan" also requires them to match.

## Why the Two Drift Apart

The site and the Plan are made by different processes at different times. `.github/workflows/deploy.yml` builds the static export on every push, from whatever `src/seed/` holds at that commit. The Plan is only remade by `scripts/daily-run.sh`, once a day on the owner's box, and a failed run keeps the previous Artifact on purpose.

So a push that edits a Rule, a Plant's tags, the tag policy or the committed history deploys straight away, beside a Plan that was made from the old records. Every view that pairs a seed Rule with the Plan can then say something the Plan never did. It might show a Guard's new effect on a Task the old Guard only annotated, a release condition the Deferral doesn't carry, or a reach the Planner never evaluated. Review on #87 found one of these at a time, and each fix only removed the instance in front of it.

## The Decision

Record the inputs on the Artifact and compare at build time.

`plannedFrom` in `src/artifact/planned-from.ts` hashes the four inputs as JSON, FNV-1a run twice for 64 bits. It only has to detect an honest edit, so collision resistance buys nothing, and it keeps a crypto dependency out of the browser bundle. `run.ts` writes it onto every Artifact it publishes. `ArtifactGate` compares it with `seedPlannedFrom` and, on a mismatch, prints one notice above the page. Every route that renders through the gate gets it: This Week, the Yard, the Rules page and the Away Card.

`todaysRun` treats a mismatch as a day that hasn't run yet. The owner schedules the run on more than one machine, so a push that changes the records gets replanned by the next scheduled attempt that same day, and the notice comes down when it does.

Where a view can read the answer off the Plan itself, it does. A Guard's verdict is recorded on each Task (`Task.guardChecks`), and its label and release condition come from the Deferral or Annotation on the Task, not from the seed Guard. The fingerprint covers what's left, which is the Rule names, conditions and schedules the pages draw from the seed.

## What Else Was Considered

Shipping the rule set inside the Artifact and rendering from it. That would end the drift for Rules outright. But a Rule is hand-authored and its schema fills eleven defaults, while the Artifact's schema forbids defaults so that a machine-written file round-trips without a key going missing (`artifact.spec.ts`). It would need a second, default-free Rule schema kept in step with the first, and Plants, Occurrences and the tag policy would still drift. It costs more and covers less.

Regenerating the Plan in CI on every push. The run needs the property's coordinates, which ADR 0004 keeps out of anything this repository or its CI can reach.

Guarding each line that pairs the seed with the Plan. That was the state before this decision, and it never finishes.

## Consequences

An Artifact written before this decision has no `plannedFrom`. The parse fills `null`, the site shows no notice for it because there's nothing to compare, and `todaysRun` treats it as a mismatch, so the next scheduled run replans once.

Any edit to the four inputs raises the notice until the next run, including a change a reader would never notice, like a Rule's source label. The notice is written to fit that case: it says the plan may not match, and it doesn't claim that it doesn't.

Recording an Occurrence in `src/seed/occurrences.json` counts as a change, which is correct, because the next Plan reads that history (ADR 0006).
