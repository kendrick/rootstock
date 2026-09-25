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

THESIS: The plan is a work-order ticket. This surface refuses the category arrangement it was measured against, a card grid of rounded tiles where the rule and the dated reading behind a task hide behind a "Why this?" link, and states the evidence on a line of its own beneath the instruction it backs. The genre was chosen because its central gesture is already the product's: a ticket is signed off, and a signature is not taken back.

OWN-WORLD: Carbonless copy stock, warm rather than white, with the canary and pink sheets under it showing as edges across the head. Dense black ink, and one rubber-stamp red rationed to a single job: work that was recorded. The sheet is a bounded object with a heavy border, ruled into cells, with a JOB / TARGET / SIGN OFF table whose vertical rules run its full height. Lettering is a heavy condensed grotesque, chosen against the font ranking because the metric winner was too light to survive being printed badly on cheap stock. Everything written on the form is typewriter. No cards, no shadows, no rounded corners, no icons standing in for labels. Registration furniture is the only ornament permitted.

STORY: The reader opens the plan in sunlight and reads one constructed numeral — how many jobs the yard is owed this week. They scan the rows, each carrying the work, its target, what to actually do, and the dated reading that produced it, with nothing to expand or tap to see why. They do the work, then press one square cell-sized control that records it and refuses to take it back.

FIRST VIEWPORT: The sheet's own border, then a head spanning its full width: wordmark in one cell, ticket number and yard stacked beside it. Below, a margin and a field. The margin carries the nav, the sign-off strip, the job and open counts, and the Rules nothing lit. The field carries the page heading, the week's summary, the Advisories directly beneath it, then the job table: bordered column heads, and each Task a ruled row with its number set large at the left, the job name and target on one line, the instruction in typewriter beneath, the evidence in stamp red below that, and the sign-off box in the last cell. The primary action is that box, one per row. The stub closes the sheet with a perforation and the count still open.

FORM: The numbered work-order ticket. It was a dealt grounded candidate in re-roll round 2, where the owner called it the right ballpark, and it was taken up after the Visible Grid won the roll, was built in full and was rejected on review for being the least materially committed world in the hand. Seed key af87c25e.

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
- RESOLVED (2026-09-25): Deferred, Approaching and Completed states share the ruled `NO. | TASK | SIGN OFF` table. A held row keeps its box under an ink HELD mark (ADR 0002), an approaching row says NOT YET and the forecast day, and the stub closes as CLOSED — N OF N RECORDED once every signable Task is recorded. DESIGN.md's Task Table section carries the detail.


## Revision, after the Visible Grid was built and rejected

The Visible Grid shipped, was reviewed against a wide viewport, and failed on four counts worth keeping on the record because they bind every surface still to come.

Type sized in `vw` grows without limit, so at 1440 the opening screen held a wordmark, a heading and one sentence. That is a phone layout enlarged. Every step now reaches its ceiling around 900px and holds; extra width goes to the layout.

A wide screen needs its own composition. One column enlarged is not a desktop design. The sheet is a margin and a field, and the margin is where the width goes.

A saturated blue accent reads as a hyperlink and says "click here" where this colour has to say "someone marked this".

Section headings set above their own prose read as a stack of small grey captions that nothing distinguishes. Sections are labelled bands with the label in the margin under a rule running the full measure.

And the finding underneath all of them: the Visible Grid was white, hairlines and type, with no material to commit to. Built faithfully it could only resolve into a well-typeset document. A world with nothing to be made of cannot be rescued by execution.

## Revision, after three critique rounds (2026-09-25)

The owner ruled on these, and they supersede the direction contract above where the two differ.

- The column heads read `NO. | TASK | SIGN OFF`. JOB is on Task's _Avoid_ line in CONTEXT.md, and each head sits over the column it names.
- Stamp red marks only recorded work: the stamp, its fill, the record line and the tally cells. The evidence line is typewriter ink, not stamp red or blue.
- The nav's first link reads This Week, matching the route's heading.
- A Task that is not delegable says so on its row, in ink.
- The approved comp is `.impeccable/mocks/this-week-job-ticket.png`, as DESIGN.md's Provenance says. The tally comp named above was approved first and belongs to the earlier round.

