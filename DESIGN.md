# Design

<!-- impeccable:design-schema 1 -->

The world is a numbered work-order ticket: the carbonless form that travels with a job through a shop and gets signed off box by box. The page is a bounded sheet with an edge, ruled into cells, and the evidence behind every Task sits on a line of its own where nothing can fold it away.

That last property is the one this design exists for. The category answer to provenance is a "Why this?" link, which promises the reasoning exists rather than showing it. This product's claim is that nothing on the page was invented, so the proof renders under the instruction it backs, every time.

The genre was chosen because its central gesture is already the product's. A ticket is signed off, and a signature is not taken back. An Occurrence is append-only and the page refuses an undo out loud, so the form and the data agree without either having to explain itself.

## Ground and Ink

| Role            | Light     | Dark      | Notes                                                                                                                                                 |
| --------------- | --------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--ground`      | `#f7f4ec` | `#14120f` | Carbonless copy stock, warm rather than white, because a ticket is paper somebody handled. Dark is the carbon copy rather than the top sheet.         |
| `--ink`         | `#1a1815` | `#f2efe6` | 16.1:1 in both schemes.                                                                                                                               |
| `--copy-canary` | `#f2e2a8` | `#6b5c2e` | With `--copy-pink`, the two sheets under the top copy, showing as edges across the head. The only decorative mark in this world, and it appears once. |
| `--accent`      | `#b02a1f` | `#ff7a6a` | Rubber-stamp red, rationed to one job: work that was recorded. 5.98:1 light, 7.34:1 dark, and white clears 6.57:1 on it.                              |
| `--muted`       | `#6b6459` | `#a09789` | 5.32:1. Tinted from the stock rather than grey, so it reads as lighter printing instead of a different material.                                      |
| `--rule`        | `#1a1815` | `#f2efe6` | A ticket is ruled, not shadowed. Heavy rules divide the sheet's regions; `--rule-faint` divides rows inside them.                                     |

The use scene picked the ground and the category had no say in it. This page is read outdoors in full Texas sun on a phone held one-handed, where a dark shell loses to reflected skylight. Dark mode follows the reader's system and offers no toggle, because the ambient light the phone already measures is what decides.

Stamp red marks work that was recorded, and nothing else takes it: the stamp, the fill that leads into it, the line under a signed-off Task giving the day it was recorded, and the filled tally cells. The evidence line, the active nav, focus rings, selection and every band are ink. On a sheet where nothing is signed off yet, nothing is red, so the first red a reader sees is their own sign-off. Colour never decorates here.

## Type

Two faces do the work, and how the first was chosen is worth recording because the process got it wrong.

**Saira Condensed 600/800** carries the lettering: wordmark, headings, Rule names, labels, column heads. `impeccable font-match` measures cap height, advance width and stroke density off an approved comp and ranks a catalogue against those numbers, and it chose Economica. The proportions were right and the weight was not. Economica is a light, elegant condensed, and a ticket head set in it reads as a magazine standfirst, where a form's lettering is heavy enough to survive being printed badly on cheap stock. That weight is most of the genre's character. 800 rather than 900, because 900 closes the counters at the size the wordmark runs.

**Atkinson Hyperlegible Mono** carries readings: the evidence lines, the ticket number, and the figures on the Rules page and the Away Card. It is the typewriter a ticket is filled in with, and it is also what `PRODUCT.md` asks for, recording a binding need for characters that stay distinct where rule ids, dates and product-label figures are read down a column and compared with their neighbours. Two separate reasons arrive at the same face.

**Assistant** carries running prose: the Task's instruction, the page standfirst and section copy. The comp set the instruction in typewriter; the owner ruled for Assistant on 2026-09-25, because a whole sentence reads faster in a proportional face than in a mono one, and the evidence line under it is where the typewriter earns its place.

The scale has eight roles, each a `--text-*` token in `globals.css`. Sizes are given at 390px and at 900px, where each one stops growing.

| Role     | Face             | 390 → 900 | Carries                                  |
| -------- | ---------------- | --------- | ---------------------------------------- |
| wordmark | Saira 800        | 24 → 32   | The name                                 |
| display  | Saira 800        | 30 → 44   | The page heading                         |
| title    | Saira 800        | 21 → 26   | Rule names, Plant names, row numerals    |
| heading  | Saira 800        | 15 → 17   | Section heads                            |
| body     | Assistant        | 17 → 18   | Instructions and running prose           |
| note     | Assistant        | 15 → 16   | Notes, disclosures, the sign-off warning |
| evidence | Atkinson Mono    | 14 → 15   | Evidence lines and other readings        |
| label    | Saira 600 or 800 | 13 → 14   | Nav, column heads, counts, marks         |

The numerals in the Yard's 24px callouts are a fixed 14px, since the callout doesn't scale either.

The use scene sets the floors. An 11px condensed uppercase label has a 7.6px cap, which full sun erases, so no lettering goes below 13px. Assistant has a small x-height, which is why body needs 17px to read the way 16px does in most faces. Between 390 and 900 each size tracks the viewport, so a tablet gets sizes of its own. Above 900 extra width goes to the layout rather than the type: a single column enlarged is what a phone layout looks like on a desktop.

Uppercase is for short lettering: names, heads, labels and marks. A sentence, or an authority's full name, is prose and goes in Assistant whatever it sits beside.

Only the 600 and 800 files of Saira load, so the classes say `font-semibold` or `font-extrabold` and never name a weight that isn't there. On a dark ground the tracking opens by 0.01em and body leading goes from 1.5 to 1.55, because light type spreads into its own counters.

Figures are tabular everywhere, because every number on this page is a measurement compared against the one above it.

## What This World Does Not Have

There are no cards, shadows, rounded corners, or icons standing in for labels, and nothing sits on a raised surface.

Anything that responds to a click says so under the pointer. Browsers ship a plain arrow on a `<button>`, which is a holdover from native widgets and reads as inert on a page, so a base rule gives the hand to every button, summary, and label wrapping an enabled input. A disabled control keeps the arrow, because it should not invite the click.

Division is a ruled border, and that border is what identifies a Task. Issues #62 and #65 raised the requirement, WCAG 1.4.11's 3:1 where a border is what identifies a component, and a raised surface with a 4.12:1 border was as close as a shell of stacked zinc surfaces could get. `--rule` on `--ground` measures roughly 16:1 and needs no surface to help it.

The surface also ships no rasters at all. It is flat shape systems, rules and type the whole way down, so the static export sends no images and a reader on cell signal in a yard waits for nothing.

## Components

### The Sheet

A bounded object with a heavy border, because a work-order ticket has an edge you could tear along and the same content without one reads as a page that merely happens to be ruled. Inside it: a head spanning the full width, then two columns, a margin carrying the nav and the week's apparatus and a field carrying the work.

The margin is what a wide screen is for. Extra width goes there so the work keeps a readable measure, instead of inflating one column until a desktop shows less than a phone does.

### The Ticket Head

Wordmark in one cell, ticket number and yard stacked beside it. The number is `No. <year>-<day of year>`, derived at read time. It is deliberately not the Artifact's generation date, which `StalenessBanner` already reports and which would put two dates on one sheet meaning different things.

### The Task Table

`NO. | TASK | SIGN OFF`, with a bordered header row and vertical rules running its full height, and each head over the column it names. The shop form says JOB; this one says TASK, because CONTEXT.md lists job under Task's _Avoid_. Ready, approaching and held work all sit in this table: an approaching row says NOT YET and the forecast day where the box would be, and a held row keeps its box under an ink HELD mark, because ADR 0002 makes a Deferral advice rather than a lock. Each Task is one ruled row: its number set large in the first cell, the Rule's name, target, instruction and evidence in the second, the sign-off box in the third. Only the sign-off cell records; the text beside it is for reading. A Task that is not delegable carries an ink NOT DELEGABLE mark in its target line, because the household can reach this page and the disclosure is not where a warning belongs. The column heads carry `aria-hidden`, because they are a printed convention rather than a table a screen reader should announce, and each row is already a list item carrying its own labelled parts.

Row order was tested. The rejected comp variation led with evidence and made the largest element on the screen read `NO OCCURRENCE`, the absence of evidence, while the work itself sat third.

The stub at the foot says how much of the week is open. Once every Task that can be signed off is recorded it closes, CLOSED — 3 OF 3 RECORDED, in ink. Approaching work is left out of that count, because it cannot be signed off and would keep a finished week open forever.

### The Plate and the Parts List

The Yard's photograph is a plate: a ruled frame with numbered callouts keyed to a parts list beneath it, the way a work order handles a diagram. A ring of identical dots says a Plant is there and nothing about which one; the number answers that with no legend, and the row carries the same number.

A callout is filled for a Plant in the ground and drawn as an outline for one that is only planned. Shape rather than colour, because it sits on a photograph whose own colours cannot be relied on and which `ADR 0004` allows to be swapped.

Hovering either a callout or its row lights both. The callout grows rather than changing colour, for the same reason: scale reads on any ground. Keyboard focus on a row drives it too, so a reader tabbing the list still sees which Plant on the plate they are standing on.

Callouts are `aria-hidden` and outside the tab order, because the parts list is the equivalent path to every Plant and an integration test pins that each Plant reaches the tab order once rather than twice. Their tooltip is therefore pointer-only by design, and everything it says is in the row the number points at.

Callouts take plate colours, fixed paper and ink that never flip for dark mode, because the photograph under them doesn't flip either. Each carries an invisible 44px hit area around its 24px mark, and the layout keeps pins 28px apart and half a pin in from every edge, so no pad covers another pin's centre and no pin is clipped.

The Yard has two readings, switched by a pair of ruled cells, `THIS WEEK | ALL PLANTS`, the pressed one printed in reverse. This Week sorts the list under ruled heads. The Plants the ticket names come first, each giving its line on the ticket ("READY NOW 01 · Fall pre-emergent"), and the Plant's sheet links straight to that line. Then come the Plants no Rule reaches, in ink, because they will never get a Task (#52), and after them the Plants whose Rules are quiet this week and the planned ones, both quieted. All Plants is the inventory, with a count on rows that have work and a sentence on any row no Rule reaches. A Plant keeps its number in both, so no callout renumbers under the reader. The view defaults to This Week whenever the ticket names a Plant, and a choice of view lives in the link's `?view=`, never on the device, so a fresh visit always gets the week.

### The Plant Sheet

The sheet is part of the sheet world, not a dialog borrowed from somewhere else. Its title is Saira and left-aligned, its section heads are ruled strips like the parts list's column heads, and Rules that ask for work are listed apart from Guards, which only hold work back or add a note. A Guard's mark and NOT DELEGABLE are printed text, never pills. A live Rule links to its line on the ticket. A threshold chart sits inside its own Rule's row, captioned with the Rule and its season, and out of season it's drawn muted with a sentence saying nothing can fire it; September soil above a spring line otherwise reads as work that fired. CLOSE is a word at 44px, first in the tab order, and a second one sits at the foot on a phone, where the sheet is full width and the top corner is the last place a thumb reaches.

### The Sign-Off Box

The ticket's own gesture, and the only thing on a row a reader can touch. Unsigned, it draws an empty ink box over the words SIGN OFF, so it reads as a control and not as a repeat of the column head. During the wait it counts down, CANCEL · 3, 2, 1, so the time left survives reduced motion. Signed, it takes a stamp. A tap that lands just after the wait ran out gets its own sentence saying it came too late, apart from the refusal an older record gets. The input fills the cell rather than sitting inside it, so the whole box is the target and its visible border is the control's own. The cell is the only target, because a label around the row would let a thumb resting on the instruction write a permanent record.

### Also Observed

Sits directly under the week's summary rather than at the foot, because weather a homeowner should act on comes before a checklist they work through.

It is exempt from the staleness de-emphasis. An Advisory is not part of a Plan (`CONTEXT.md`), so it has none of the Plan's staleness to inherit, and rain that is unlikely this week is worth acting on whether or not the daily run stopped. The block says in words that no Rule produced it, so a reader who never notices a border still cannot mistake it for cited work.

### The Annotated Specimen

`/about` has to argue to somebody who has never seen the plan, and the only honest way to do that is with the plan. The page is built from the ticket's own parts: a real row out of this morning's Artifact, set in the job table's grammar, with superscript callouts numbered into a list beneath it. What the Planner authored this morning is what the reader gets.

The model's boundary takes a two-column spec table, MAY against MAY NOT. A paragraph describing a limit reads as reassurance; a table reads as a specification. Under it sits the instruction the Narrator is handed, word for word, and then the same job written both ways, so the difference the model makes is on the page rather than claimed.

Nothing here was written for the page. `NARRATOR_BRIEF` lives in `src/generation/narrator-brief.ts` and both the daily run and this page read it, because a second copy of the prompt is how the page drifts into a flattering paraphrase of what the model was actually asked.

### The New Here Band

One band above the plan, bordered in ink. It explains the evidence line and what the model may not do rather than what the product is, since the guarantee is the part a stranger cannot infer by looking, and it points at `/about`. The daily reader owes a banner nothing, so a dismissal is permanent. The browser that saw it keeps that answer, which is the right behaviour for a household where the card gets opened on somebody else's phone.

### NOT THIS WEEK

The Rules the yard holds that no evidence lit, kept in the margin. This is the one part of the page that argues ADR 0001 without saying anything: the rule set is fixed, the Planner invents nothing, and evidence alone decides which Rules speak today. Guards are excluded, because a Guard creates no work and so has nothing to be silent about.

## Motion

Two moments, and the distinction between them is the rule.

**The stamp** belongs to the only action that cannot be taken back. Recording work writes an append-only Occurrence, there is no undo, and the page refuses one out loud. So the control stamps instead of toggling: the mark lands slightly rotated and fully formed in 140ms rather than fading up, because a stamp is a single impact and anything smoother reads as a switch. It has no reverse, because the Occurrence has none either.

The stamp has a lead-in. A tap on the sign-off cell starts a four-second wait before anything is written, and during it a grey RECORDING stamp fills with stamp red from left to right while the cell says a second tap cancels. The fill is linear because it's a clock. Red is complete only at the impact, so red still means recorded work. The wait and the stamp count as one moment, since the wait exists because the act is irreversible and the stamp lands when the wait runs out.

**The plant sheet** slides in from the edge and back out, 200ms in and 150ms out. It is the one thing on any surface that arrives over the page, and a panel that pops gives a reader no sense of where it came from or where it returns to. Out is quicker than in, because leaving needs no explaining. shadcn's defaults ran 500ms and 300ms, which beside a 140ms stamp read as a different product.

Nothing else moves. The rule is not a count: motion here earns its place by carrying meaning that the still frame cannot, either the weight of an irreversible act or the continuity of something entering and leaving. Anything that moves to be noticed does not qualify, and a third such moment would make the first two ordinary.

Under `prefers-reduced-motion` both arrive immediately and without the travel, since the information was never in the movement.

## Print

Paper has one scheme. The Away Card is printed and read in a hand, so print pins the light values whatever the screen was doing, flattens the stamp red to ink, and drops the carbonless copy edges, which are a screen convention and on paper would be two bands of wasted toner.

## Migration Debt

`globals.css` carries the old shell's token vocabulary (`--color-card`, `--color-muted-foreground`, and the rest) remapped onto this world. The shared pieces every route pulls in—`citation.tsx`, `staleness-banner.tsx`, `rule-summary.tsx`, `artifact-error.tsx`, `soil-sparkline.tsx`—still speak those names, and dropping the tokens would leave parts of every surface unstyled at once. They are not a second palette, since every one resolves to a value above. Each dies as its component is redrawn, and the last one out takes the block with it.

## Provenance

The direction came from a four-round roll, seed `af87c25e`. The Visible Grid won that roll, was built in full, and was rejected on review: it was the least materially committed world in the hand, white and hairlines and type, and built faithfully it could only resolve into a well-typeset document. The Job Ticket was taken from the same hand in its place, where it had already been called the right ballpark.

`.impeccable/mocks/this-week-job-ticket.png` is the approved comp for this world. The rest of the hand, their prompts and their approval records sit alongside it, and the direction contract is in `.impeccable/surfaces/src-app-page-tsx.md`.
