---
version: 1
slug: "src-app-page-tsx"
primary_target: "src/app/page.tsx"
related_targets: ["src/components/this-week","src/components/shell"]
---

# This Week

Scope: the This Week route (`src/app/page.tsx`) and the shell it renders inside. Visitor mode: Operate.

Audience: the property owner, in the yard, in full sun, phone in one hand, deciding what to do this week. The Away Card's household reader and the cold-arrival homepage reader are separate surfaces and are not designed here.

Job: read this week's work, understand what produced each piece of it, act, and record that it happened.

Constraints: static export, no server runtime, no browser model call. WCAG 2.2 AA is binding. The domain vocabulary in CONTEXT.md is binding on reader-facing copy. Recording is irreversible by design (`UNDO_REFUSAL`), and the surface must say so before it commits, not after.

## Direction contract

THESIS: The plan shows its own machinery. This surface refuses the category arrangement it was measured against — a card grid of rounded tiles where the rule and the dated reading behind a task hide behind a "Why this?" link — and instead keeps the construction grid that builds the page permanently visible, with the evidence set on the cell line directly beneath the instruction it backs.

OWN-WORLD: Pure white ground carrying a faint pale-blue construction grid at all times, visible but quiet. Near-black type. One saturated blue as the only accent, earned by four things and nothing else: the display numeral, the active nav underline, a checked control, and the evidence line. Every element snaps to whole grid cells — no rounded corners, no drop shadows, no soft elevation, no cards. Division is hairline rules landing exactly on grid lines. Display numerals are constructed cell by cell out of the grid itself rather than set in a typeface. Body copy is a legibility-first grotesque; evidence is monospaced and tabular. Registration furniture is the only ornament permitted: rules, cell marks, and the grid. Nothing decorative earns a place.

STORY: The reader opens the plan in sunlight and reads one constructed numeral — how many jobs the yard is owed this week. They scan the rows, each carrying the work, its target, what to actually do, and the dated reading that produced it, with nothing to expand or tap to see why. They do the work, then press one square cell-sized control that records it and refuses to take it back.

FIRST VIEWPORT: App bar, wordmark at left, a one-cell GRID control at right. Nav row beneath: PLAN active under a blue cell-width underline, then YARD and RULES. Then the tally band, a full-width strip of equal square cells two cells tall: filled blue for recorded, black-outlined white for open, faint pale blue for nothing scheduled, so the week's load is countable before a word is read. Beneath it, the count in condensed caps at left and region, zone and generation date in grey at right. A black hairline on a grid line, then dense Task rows separated by hairlines: a square checkbox at the left edge shipping at a 44px minimum target, job name in bold condensed caps, target right-aligned in grey caps, the instruction in body grotesque, and the evidence in blue mono on the next cell line. The primary action is that checkbox, one per row, at the left edge where a thumb reaches. Below the last row, a quiet NOT THIS WEEK block naming the rules evidence did not light. Footer: artifact age at left in grey, open count at right in blue.

FORM: The gridded type specimen, whose construction grid stays on the page as a real toggleable state. It won as a dealt challenger in the bolder register rather than as a candidate on my own grounded list, which ran irrigation controller, field notebook, inspection tag, weather console, job ticket, comparator chart, pick ticket. Seed key af87c25e, re-roll round 3, bolder register, chosen over Struck Cathode on sunlight legibility and on clearing WCAG 2.2 AA without a fight.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Approved comp

`.impeccable/mocks/this-week-tally.png` — approved at the comp round, seed af87c25e.

Carries forward: the cell tally band as the count; job name leading, instruction second, evidence in blue mono on its own cell line; the NOT THIS WEEK block listing rules evidence did not light.

Must not be literalized: the one-cell checkbox size (the control ships at a 44px minimum target), the NOT THIS WEEK grey (ships at 4.5:1 or better), and the comp's nav spacing. Accessibility, interaction states, and responsive behaviour are implementation responsibilities, not comp geometry.

Rejected at the comp round: evidence-led hierarchy. The render showed the largest element on the screen reading NO OCCURRENCE while the work sat third. Evidence is present always, and never leads.

## Comp divergence, recorded at the hero gate

The approved comp is authoritative for the **task row** and not for the page. It was authored from the Artifact's three Tasks and the narration alone, and it omitted content This Week already carries: the page heading, the Purpose paragraph that issue #50 put above the first Task, the week summary, the Ready now framing, the permanence note, each Task's Guard notes and Citation disclosure, the Held back section, and Advisories. The real page holds roughly twice the vertical content the comp drew, so no region can land on its spec box and the hero gate scored 69.3% against a 72% floor, measuring that offset rather than any defect in the build.

The hero phase was advanced with `--force` and this reason, by the owner's decision, after the alternatives were put to them: re-comp against the true content and re-approve, or cut page content to match the comp. Cutting was refused because it would delete a recorded product decision to make a measurement pass.

What this binds for the finish review: audit the build against the direction contract above, not against region-box geometry. The row's hierarchy is the part the comp actually tested and got right, and it is not open for renegotiation: job name leads, target sits right-aligned beside it, the instruction follows, and the evidence sits on its own line in accent mono where nothing can fold it away.

Do not re-run `comp-spec --regions` against this comp expecting a pass. A future spec of this surface needs a comp authored from the whole page.

## Phase machine, set aside at the hero gate

Owner decision, after the alternatives were put to them. The machine earned its keep once: it caught that display type was running at roughly half the comp's measured cap heights, which was this direction's commitment under-delivered, and correcting that was the largest single improvement in the build. Past that point it scores pixel-position similarity against an image-model render that omits a third of the page's real content and carries its own arbitrary vertical rhythm, so further convergence would mean moving real content to resemble a picture. Successive passes ran 69, 65, 66, 65, 67.5 while the design got better on judgment rather than on score.

Everything from `sections` onward is therefore built as ordinary engineering and audited against the direction contract above, not against region-box geometry. The FINISH line still binds: this build is not done until the finish review, the verdict, DESIGN.md, and provenance on every shipping raster (there are none — this world ships no images at all).

## Unresolved

- RESOLVED: the GRID control toggles the construction grid and nothing else, and it is an accessibility escape hatch rather
  than a feature. A pattern held permanently behind body text is a real problem for visual stress and low vision, and this
  world puts one there by design; the control is how a reader turns it off, and the choice persists. The two larger jobs it
  was a candidate for already have homes and must not be duplicated here: the whole rule set belongs to the /rules route,
  and full citation detail belongs to the existing Citation disclosure. NOT THIS WEEK stays a quiet grey list and does not expand.
- Body and mono faces are not yet chosen. Atkinson Hyperlegible Next and its mono companion are the leading candidates on the binding a11y requirement, not inherited from the incumbent by default.
- Deferred, Approaching and Completed Task states have no composition yet; today's Artifact contains none. They must be designed before this surface is called done.
