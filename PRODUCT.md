# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary reader is the property owner, standing in the yard, deciding what to do this week. One person, one property, on a phone held one-handed outdoors.

The second reader is the rest of the household, who read the Away Card: a printable, read-only list of work that may be delegated. They have standing to do the work on that card and no standing to judge what is missing from it, which is why a Deferred Task is counted there but never named.

The third reader is someone arriving cold with no idea what this is—mostly a household member handed a link, and some of the time a stranger who found the public URL. Weight them roughly 60/40 in that order. This reader is real but secondary: the product is built for the household, and written so an outsider is not confused either. There is nothing to sell them. `/about` makes its case out of the committed Artifact and the real rule set, so a reader who doubts a claim can go and check it against the plan.

That reader lands on `/about`, because This Week states the plan without establishing what produced it or why it should be trusted. The page annotates a real row from this morning's ticket and sets out what the model may and may not do. It also quotes the instruction the Narrator is handed, word for word. This Week stays at `/` for the owner who opens the site daily, and a dismissible band there points a first-time visitor across.

## Product Purpose

Rootstock answers one question a day: what does the yard need this week, and why. Every Task it shows carries the Rule that produced it and the dated reading that fired that Rule.

Success is the owner acting on the week's work with the reasoning in hand, and the household completing delegable work off the Away Card without being told anything the card has no standing to tell them. Failure is a plausible-sounding task with nothing behind it.

## Positioning

The Planner is the only thing in the system that may create a Task. A model may select, order, and write prose over a finished Plan; it may not add a Task, remove one, or change a date, and narration naming a rule ID the Plan does not hold is rejected in favor of mechanical prose. Turn the model off and the same Tasks appear on the same dates—only the wording changes, from written sentences back to the terse mechanical ones the Planner already put in each `Task.title`—and the Artifact records which of the two it carries.

A Guard holds work back and says what would release it. No Guard can delete a Task, because a Task that disappears is indistinguishable from one nobody thought of.

Those two properties are the product. A neighboring yard-task app can copy the list; it cannot truthfully copy the claim that nothing on the list was invented.

## Operating Context

- The site is a static export on GitHub Pages with no server runtime, no browser-side model call, and no browser-side network fetch. The build bakes in the committed Artifact and the page parses it.
- `scripts/daily-run.sh` is the whole pipeline: fetch Observations from Open-Meteo, run the Planner, narrate, write `data/artifact.json` and `data/status.json`, commit, push. The push is the deploy. A failed run still commits its status record, which is how the site says so.
- The job runs unattended at 06:00 local on the owner's Mac via a launchd agent, from a checkout of its own at `~/.local/share/rootstock-daily`. First unattended run was 2026-09-15.
- Staleness is the one figure computed at render time, because a baked answer becomes a lie the moment the daily run stops.
- Reading happens outdoors, in full sun, one-handed, often with dirty hands. The Away Card is read on paper.
- Ticking a Task writes an Occurrence to that browser's IndexedDB. The daily run plans from committed history in `src/seed/occurrences.json` alone, so a tick changes what that reader sees and never what the site publishes.

## Capabilities and Constraints

- Four Rule kinds—Window, Threshold, Cadence, Guard—stored as data, not code. Guards create no work.
- Routes today: This Week (`/`), Yard (`/yard`), Rules (`/rules`), About (`/about`), and the Away Card at `/away/[slug]`. The Away Card is never linked from the nav, because the slug is deliberately not a `NEXT_PUBLIC_` variable and never reaches the browser bundle.
- Exact coordinates never enter the repository. They live in the generation environment and nowhere else, and a spec walks the generated JSON Schema failing on any property named for a latitude or longitude (ADR 0004). The Away Card slug is the same problem in a different shape.
- Seed data is the documented add-a-plant path for this release, so its JSON shape is the import format rather than an internal convenience.
- Next 16, React 19, Tailwind 4, Radix primitives, Zod schemas, static export. Node 24+, pnpm 10.
- The domain vocabulary in `CONTEXT.md` is binding and exact. Every entry carries an `_Avoid_` line naming synonyms that must not be used, in code or in reader-facing copy: a Rule is not a Task, an Occurrence is not a checkbox, an Advisory is not a Citation, and This Week never becomes Schedule.
- Decisions with consequences live in `docs/adr/`. Work that contradicts one says so rather than quietly overriding it.
- Scope is one property now, others later. The yard is the only instance built for, and `region` plus hardiness zone on a Rule record provenance rather than open a multi-tenancy seam. Future work should avoid foreclosing a second property without building for one.
- Known open product gaps, tracked as GitHub issues: threshold rules fire only after a crossing, so pre-emergent work is timed late (#48); Guard conditions cannot express a temperature limit (#34); rules name plants by ID, so a new plant reaches no rule (#52); an expired narration credential publishes a green run (#77).

## Brand Commitments

- The name is `rootstock`, rendered lowercase, with no logo and no tagline. It lives as one constant in `src/components/shell/name.ts` that both the header and the document title import, and `header.spec.tsx` asserts the rendered banner's whole text is that constant.
- Voice follows the domain vocabulary: exact, unhedged, and willing to say what a thing costs. The README and the ADRs are the reference for it.
- Weather data is Open-Meteo under CC BY 4.0, and the attribution renders in the footer of every route. That is a licence obligation, not a design choice.

## Evidence on Hand

- `public/yard.jpg`—a real photograph of the property, 1619×971, used for Plant Pins placed by fractional position.
- `src/seed/plants.json`, `rules.json`, `occurrences.json`, `tag-policy.json`, `yard.json`—the real inventory, rule set, and occurrence history for the property, not fixtures.
- `data/artifact.json` and `data/status.json`—the live committed output of the daily run.
- Live site at `kendrick.github.io/rootstock`.
- Six ADRs in `docs/adr/`, each arguing the alternative it rejected.
- There are no customers, testimonials, case studies, press, benchmarks, pricing, or usage figures. This is one person's tool for one yard. Future work must not invent any.

## Product Principles

1. **Nothing appears without its provenance.** A Task carries the Rule and the dated reading behind it, or it does not render. The citation is not a disclosure footnote; it is the thing being shown.
2. **Held back is not gone.** Deferred, Withheld, Approaching, and Completed all stay in the Plan and stay visible in their own right. Disappearance is the one failure the system refuses.
3. **The model chooses words, never facts.** Prose is replaceable and the Artifact says whether it ran. Anything that only works when the model is on does not ship.
4. **Derived figures are derived at read time.** Staleness, completion, and the staleness band are computed on every render, never stored, because a stored answer outlives the thing it described.
5. **Say what it costs.** Every recorded decision names the alternative it rejected and what the choice gives up.

## Accessibility & Inclusion

WCAG 2.2 AA is binding. It is enforced, not aspirational: `@axe-core/playwright` runs against the built static export, and contrast reasoning is written into `src/app/globals.css` at the point of decision.

Two product-specific needs sit underneath the standard:

- **Full-sun outdoor reading on a phone.** Legibility at a glance, generous contrast, and target sizes that survive a one-handed grip with dirty hands.
- **Dense numeric reading.** Soil temperatures, dates, rule IDs, and product-label figures are read down a column and compared against neighbors, so digits must align and characters that collapse into each other must stay distinct.

The Away Card is read on paper, so it must survive printing with no color, no interaction, and no link it asks anyone to follow.
