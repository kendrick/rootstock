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

`NO. | TASK | SIGN OFF`, with a bordered header row and vertical rules running its full height, and each head over the column it names. The shop form says JOB; this one says TASK, because CONTEXT.md lists job under Task's _Avoid_. Ready, approaching and held work all sit in this table: an approaching row says NOT YET and the forecast day where the box would be, and a held row keeps its box under an ink HELD mark, because ADR 0002 makes a Deferral advice rather than a lock. Each Task is one ruled row: its number set large in the first cell, the Rule's name, target, instruction and evidence in the second, the sign-off box in the third. Only the sign-off cell records; the text beside it is for reading. A Task that is not delegable carries an ink OWNER ONLY mark in its target line, and its box reads OWNER SIGNS OFF, because the household can reach this page and the disclosure is not where a warning belongs. Delegable is the glossary's word; the household reads this row. The Plant and the mark sit together as one group at the line's end, so neither floats mid-line on a wide screen. A Deferral under a held row names its Guard and what releases it, and where the Guard reads a series, the days it read print under that in the evidence line's type ("RAIN CHANCE SEP 28 8% / SEP 29 2% / SEP 30 78%"), so the hold is as checkable as the Task. The drawer under each row is labelled RULE AND EVIDENCE and nothing more, since the row already names the Rule. The permanence note prints once, over the ready work; held rows point at it rather than repeating it. The column heads carry `aria-hidden`, because they are a printed convention rather than a table a screen reader should announce, and each row is already a list item carrying its own labelled parts.

Row order was tested. The rejected comp variation led with evidence and made the largest element on the screen read `NO OCCURRENCE`, the absence of evidence, while the work itself sat third.

The stub at the foot says how much of the week is open. Once every Task that can be signed off is recorded it closes, CLOSED — 3 OF 3 RECORDED, in ink. Approaching work is left out of that count, because it cannot be signed off and would keep a finished week open forever.

### The Plate and the Parts List

The Yard's photograph is a plate: a ruled frame with numbered callouts keyed to a parts list beside or beneath it, the way a work order handles a diagram. A ring of identical dots says a Plant is there and nothing about which one; the number answers that with no legend, and the row carries the same number.

Every callout is a paper chip with an ink numeral, which reads on any part of the photograph. A solid border marks a Plant in the ground and a dashed one a Plant that is only planned. Line style carries it rather than colour, because the photograph's own colours cannot be relied on and `ADR 0004` allows it to be swapped. In the week view, a callout whose Plant is on this week's ticket is printed in reverse, the mark a pressed cell takes, and the rest stay at full strength.

Hovering either a callout or its row lights both. The callout grows rather than changing colour, for the same reason: scale reads on any ground. Keyboard focus on a row drives it too, so a reader tabbing the list still sees which Plant on the plate they are standing on.

Callouts are `aria-hidden` and outside the tab order, because the parts list is the equivalent path to every Plant and an integration test pins that each Plant reaches the tab order once rather than twice. Their tooltip is therefore pointer-only by design, and everything it says is in the row the number points at.

Callouts take plate colours, fixed paper and ink that never flip for dark mode, because the photograph under them doesn't flip either. Each carries an invisible 44px hit area around its 24px mark, and callouts stay 28px apart, so no pad covers another's centre. A callout with room sits on its Plant. One that would crowd another moves out of the photo into a band above or below it, on its Plant's side, spaced along the band, with a leader back to a mark on the Plant's true spot, the way a parts plate handles a crowd. A band holds 11 callouts across a phone's photo; a bigger crowd stacks a second row farther out, and the plate grows to take it only then. Leaders in a row never cross, and hovering or focusing a row lights its leader and spot along with its chip. From `lg` the plate sits beside the parts list and stays in view while the list scrolls. A yard with no photo has no plate and no key, and the list takes the full width.

A key under the plate prints the chips themselves: planted, planned, and in the week view, on this week's ticket. Above the plate, one line gives the Plan's date and how many ticket lines land on how many Plants, since nothing else on the route says which week it shows.

The Yard has two readings, switched by a pair of ruled cells, `THIS WEEK | ALL PLANTS`, the pressed one printed in reverse. This Week sorts the list under ruled heads. The Plants the ticket names come first, each giving its line on the ticket ("READY NOW 01 · Fall pre-emergent"), and the Plant's sheet links straight to that line. Then come the Plants no Rule reaches, in ink, because they will never get a Task (#52), and after them the Plants whose Rules are quiet this week and the planned ones, both quieted. All Plants is the inventory, with a count on rows that have work and a sentence on any row no Rule reaches. A Plant keeps its number in both, so no callout renumbers under the reader. The view defaults to This Week whenever the ticket names a Plant, and a choice of view lives in the link's `?view=`, never on the device, so a fresh visit always gets the week.

### The Plant Sheet

The sheet is part of the sheet world, not a dialog borrowed from somewhere else. Its title is Saira and left-aligned, led by the same chip and number the plate draws, and under it the kind is lettered while the site, the owner's sentence, reads as prose. Its section heads are ruled strips like the parts list's column heads. It reads in the order the owner needs it. THIS WEEK comes first, with each of the Plant's ticket lines linking to its row on This Week, whole-yard work included, since a Rule that names no Plant reaches every one, and a Guard holding or marking that work today is named under the line with what releases it. With nothing on the ticket, one sentence says whether the Rules are quiet, no Rule reaches the Plant, or it isn't planted yet. An unreached Plant also gets the next step, naming its tags, because a Rule reaches a Plant by its id or a tag. A quiet Rule says when it next asks for work in the Rules page's own words, and each Guard says whether it is acting on this week's ticket. Rules that ask for work follow, listed apart from Guards, which only hold work back or add a note. A Guard's mark and NOT DELEGABLE are printed text, never pills. NOT DELEGABLE reads the Planner's stamp on the Task where there is one, and the Rule narrowed by tag policy where there isn't, never the Rule's own field. A threshold chart sits inside its own Rule's row, and out of season it folds behind the day its season opens, because September soil above a spring line reads as work that fired. Recorded work carries stamp red, as This Week's record line does. Site conditions come last, the owner's descriptions in Assistant and figures in mono. CLOSE is a word at 44px, first in the tab order, and on a phone a second one sticks to the foot of the sheet, since the top corner is the last place a thumb reaches.

### The Sign-Off Box

The ticket's own gesture, and the only thing on a row a reader can touch. Unsigned, it draws an empty ink box over the words SIGN OFF, so it reads as a control and not as a repeat of the column head. During the wait it counts down, CANCEL · 3, 2, 1, so the time left survives reduced motion. A screen reader hears "Press again to cancel. Recording in 4 seconds." and not the Task, which the box's own name already carries, so the way out lands well inside the wait. Signed, it takes a stamp. A tap that lands just after the wait ran out gets its own sentence saying it came too late, apart from the refusal an older record gets. The input fills the cell rather than sitting inside it, so the whole box is the target and its visible border is the control's own. The cell is the only target, because a label around the row would let a thumb resting on the instruction write a permanent record.

### Closing Soon

One ink band above the week's summary, drawn only when window work is within three days of closing on the Plan's date. Each line names the Task, the day its window closes, and for held work the Guard holding it and the first day at or past that Guard's line before the close: "the forecast gives Wed, Sep 30 a 78% chance of rain." The line links to the row, where the evidence is. It reorders nothing. The ticket runs ready, approaching, held, which is right for working down the sheet and wrong for the one morning a held Task's window is about to shut, so the band says it first instead. The close is a date, never "in 2 days": a count would be measured from the Plan, and on a stale morning it would be wrong in a way nobody could see.

### Also Observed

Sits directly under the week's summary rather than at the foot, because weather a homeowner should act on comes before a checklist they work through.

It is exempt from the staleness de-emphasis. An Advisory is not part of a Plan (`CONTEXT.md`), so it has none of the Plan's staleness to inherit, and rain that is unlikely this week is worth acting on whether or not the daily run stopped. The block says in words that no Rule produced it, so a reader who never notices a border still cannot mistake it for cited work.

### The Annotated Specimen

`/about` is "How this works", the page the footer and the New Here band both link. It has to explain the product to somebody who has never seen the plan, and the only honest way to argue is with the plan. It says what the site is and who it's for before it claims anything, defines Task, Rule, Plan and Artifact in a ruled list, then runs in the order a cold reader asks. How a day runs is six numbered rows in the Task table's grammar, numbered because each step reads what the one before it produced, and under them the four kinds of Rule sit in a ruled definition list. "Nothing here was invented" heads the specimen, where the page proves it. After that come one ruled row per route and the Narrator's boundary. A contents strip under the standfirst jumps to each. From `sm` it sticks to the top of the column, and on a phone, where its four links wrap to two rows, it stays put. Section heads take the title size so they read above the step labels under them. The margin's Not This Week list stays off this page, because on a phone it lands after the last section and reads as part of it.

Each of the six steps ends in a readout of what that step did on the run behind the current ticket. It's one mono line in the evidence line's grammar, with `/` between its figures, and a caption above the list says they come from the real run. Every figure comes from `data/artifact.json` or `data/status.json`: the window's days and variables, the Tasks written and the Rules and Plants behind them, what each Guard did as the Rules page reads it, how many sentences the Narrator wrote, and when the Artifact was generated. The Rule count prints only when the Artifact's `plannedFrom` matches the build's seed. Times are in UTC and say so, because the property's time zone never reaches the build. The last step reports the last attempt and the run of failures from the status record rather than an age, since an age needs the reader's clock and the staleness banner above the specimen already reads it. After a failed attempt that record is a later run than the ticket's, so the line calls it the latest attempt and dates the ticket beside it, and the caption says step 6 is the exception. When either file won't parse, the page leaves out the caption and the readouts.

The specimen is a real row out of the committed Artifact, drawn exactly as This Week draws it: the same `NO. | TASK | SIGN OFF` heads and columns, the Plant, NOT DELEGABLE where the stamp says so, an inert empty sign-off box, and the Guard notes and the inert Rule and evidence strip under the row. Plant and NOT DELEGABLE get notes of their own. It prefers fired work a Guard reached, so the reader sees a Guard at work. Superscripts are `aria-hidden`, and each numbered note opens with the name of the part it describes, so a screen reader hears no stray digits. When the Artifact fails to parse, a sentence says so in place of the specimen. The staleness banner sits above the specimen, since step six says every page showing the ticket warns about its age.

The model's boundary takes a two-column spec table, MAY against MAY NOT. A paragraph describing a limit reads as reassurance; a table reads as a specification. The MAY list covers the summary, one sentence per Task, skipping, and Advisories; MAY NOT includes the order, which the Planner sets and This Week keeps. The paragraph under it says exactly what `validateNarration` checks, which is Task IDs and not wording, and why the evidence line prints beside the sentence anyway. The instruction the Narrator is handed sits folded in a `<details>`, word for word. After the brief comes a second narrated Task written both ways, each side printed as a row prints it, so the difference the Narrator makes is on the page rather than claimed.

Nothing here was written for the page. `NARRATOR_BRIEF` lives in `src/generation/narrator-brief.ts` and both the daily run and this page read it, because a second copy of the prompt is how the page drifts into a flattering paraphrase of what the model was actually asked.

### The New Here Band

One band above the plan, bordered in ink. It explains the evidence line and what the model may not do rather than what the product is, since the guarantee is the part a stranger cannot infer by looking, and it points at `/about`. The daily reader owes a banner nothing, so a dismissal is permanent. The browser that saw it keeps that answer, which is the right behaviour for a household where the card gets opened on somebody else's phone.

### NOT THIS WEEK

The Rules the yard holds that no evidence lit, kept in the margin. This is the one part of the page that argues ADR 0001 without saying anything: the rule set is fixed, the Planner invents nothing, and evidence alone decides which Rules speak today. Guards are excluded, because a Guard creates no work and so has nothing to be silent about.

### The Rule Register

The Rules page lists every Rule under four bands in the order a reader asks: Fired this week, Approaching, Waiting, Guards. A band with nothing in it isn't drawn. A standfirst under the heading says how to read the page, and under it sits a contents strip in `/about`'s grammar, linking each band that's drawn and no other. It sticks from `sm`, and jumps land below it. Each Rule is a ruled row. Its status sits straight under the name, between faint rules, and the record follows. The kind is printed in words among the record's marks ("WINDOW RULE") and read in the heading to a screen reader. The page has no key to the kinds, since each one is spelled out.

The status says only what the band doesn't. A fired Rule gives the day its window or season closes, then its lines on this week's ticket ("Held back 01"), each linking to that row on This Week and numbered the way the ticket numbers them. A Rule with lines for several Plants names each Plant after its line. A waiting Rule gives the day it opens, and in season it gives the reading it's waiting on in the Rule's own terms: a directed Rule needs a Crossing, so the line says "needs a rise through 55°F". Readings round to one decimal. A waiting follow-up links the Rule it follows. Until that Rule's work is on record the line says "Waits on", and once it is the line gives the interval and the day it counts from, "Due 42–56 days after Spring pre-emergent, recorded March 3, 2026". Each Plant counts from its own record, so for a follow-up reaching several Plants the line cites the record that comes due first and names its Plant.

The record opens with a For row naming the Plants the Rule reaches, resolved the way the Planner resolves them, so a planned Plant isn't named and a whole-yard Rule reads "Every plant". A Guard has no For row, since its Reaches row covers it. A source label prints once per Rule. Where a published range comes from the Rule's own authority, the range links its sheet as "Source" and doesn't repeat the name.

A Guard's status names every Task it reached this week, one to a line, under what its condition concluded there: "Deferring:" or "Annotating:" where it acted, "Let through unchecked:" where its evidence was unavailable, and "Let through:" where it looked and the work could go ahead. A deferring Guard that's deferring work adds what releases it. Its record says what it looks at ("Applies when") and which work it looks at ("Reaches"), so a reader can check "let through" against both. Without the verdicts, a Guard that checked a Task and found it clear would read the same as one that reached nothing. The page reads them from `Task.guardChecks`, which the Guard pass records. On a Plan written before that record existed, it shows only what left a mark, "Deferring:", "Annotating:" or "Let through unchecked:", and never calls a Task clear.

Readings are ink, and nothing on this page is stamp red, since it records nothing. A Guard carries no delegability mark, because Delegable is a property of a Task and a Guard creates none. The page doesn't repeat the Region either, since the ticket head already carries it, and the margin drops its Not This Week list, since Waiting already names those Rules.

## Motion

Two moments, and the distinction between them is the rule.

**The stamp** belongs to the only action that cannot be taken back. Recording work writes an append-only Occurrence, there is no undo, and the page refuses one out loud. So the control stamps instead of toggling: the mark lands slightly rotated and fully formed in 140ms rather than fading up, because a stamp is a single impact and anything smoother reads as a switch. It has no reverse, because the Occurrence has none either.

The stamp has a lead-in. A tap on the sign-off cell starts a four-second wait before anything is written, and during it a grey RECORDING stamp fills with stamp red from left to right while the cell says a second tap cancels. The fill is linear because it's a clock. Red is complete only at the impact, so red still means recorded work. The wait and the stamp count as one moment, since the wait exists because the act is irreversible and the stamp lands when the wait runs out.

**The plant sheet** slides in from the edge and back out, 200ms in and 150ms out. It is the one thing on any surface that arrives over the page, and a panel that pops gives a reader no sense of where it came from or where it returns to. Out is quicker than in, because leaving needs no explaining. shadcn's defaults ran 500ms and 300ms, which beside a 140ms stamp read as a different product.

Nothing else moves. The rule is not a count: motion here earns its place by carrying meaning that the still frame cannot, either the weight of an irreversible act or the continuity of something entering and leaving. Anything that moves to be noticed does not qualify, and a third such moment would make the first two ordinary.

Under `prefers-reduced-motion` both arrive immediately and without the travel, since the information was never in the movement.

## Print

Paper has one scheme. The Away Card is printed and read in a hand, so print pins the light values whatever the screen was doing, flattens the stamp red to ink, and drops the carbonless copy edges, which are a screen convention and on paper would be two bands of wasted toner.

The Away Card's route sets `@page { margin: 0 }` and moves the 0.75in margin onto the body. With no page margin, Chrome has nowhere to draw its default header and footer, and that footer is the page URL, which on this route carries the slug. A reader who never unticks "Headers and footers" would otherwise print the card's one secret. A normal week prints on one Letter page, and an end-to-end spec counts the pages in the PDF to hold it there.

## The Stub

The Away Card is the stub: the copy torn off the ticket and handed to whoever does the job. It's a different thing from the count at the foot of This Week's Task Table, which this document also calls a stub. The household holds it, in the yard, with a pen. They have standing to do the work on it and none to judge what's missing from it, so everything on the stub is either work they can do or a count of work they can't.

The head carries the ticket number, `No. <year>-<day of year> · Stub`, derived the way the Ticket Head derives it but from the Plan's date, so every copy of one week's card carries one number. Under it the heading names the yard and the Plan's week ("Yard tasks, week of Sep 28"), never the reader's today, because the sheet lives on a fridge for days. A mono line says when the card was made, year included. The staleness banner's prominent variant sits above the first row and speaks to the household: a failed run asks them to tell whoever gave them the card.

The rows use the Task Table's grammar, cut down to what the household needs: `NO. | TASK | SIGN OFF | INITIALS / DATE`. The numeral is set in the title role. The instruction is Assistant `text-body` prose, and under it a mono line in the evidence role says when the row stops mattering: "By Thu Oct 1" for a Window Rule, from the Rule's window end, and "This week" for everything else. Rule names and evidence stay off, since this reader can't act on either. SIGN OFF is an empty ink box for a pen. INITIALS / DATE is a blank cell for the returned sheet to carry back who did the work and when, which the owner can then record. On a phone below `sm` the write-in cell drops out, since nobody writes on a screen. Print always keeps it.

Work the committed history already records prints as recorded. Its box carries an ink cross and its line reads "Already recorded Sep 27", because a missing row reads as work nobody called for and the household would do it again. The history is `src/seed/occurrences.json` alone, never a browser's ticks (ADR 0006).

The stub ends on whose the rest is. It counts Withheld work in its two senses, the owner's to do and held back until conditions change, names none of it, and closes on "This card isn't the whole week. The rest is the owner's to do or to decide." Undelegable work counts as the owner's even when a Guard held it back, so the card never implies it will come to the household. The Deferral still stops the owner, so that sentence says how much waits: "2 more tasks are the owner's to do, 1 of them once conditions change." The empty states thank the reader, and the error state tells them to ask whoever gave them the card. The stub's copy calls itself a card, never a list, because list is on the Plan's _Avoid_ line, and it keeps the _Avoid_ words for Deferral and Completed Task (hold, done) off the page.

The stub is ink on white, with no colour, no interaction, and no link, footer included. The Print button is the one control, 44px tall, and it doesn't print.

## Migration Debt

`globals.css` carries the old shell's token vocabulary (`--color-card`, `--color-muted-foreground`, and the rest) remapped onto this world. The shared pieces every route pulls in—`citation.tsx`, `staleness-banner.tsx`, `rule-summary.tsx`, `artifact-error.tsx`, `soil-sparkline.tsx`—still speak those names, and dropping the tokens would leave parts of every surface unstyled at once. They are not a second palette, since every one resolves to a value above. Each dies as its component is redrawn, and the last one out takes the block with it.

## Provenance

The direction came from a four-round roll, seed `af87c25e`. The Visible Grid won that roll, was built in full, and was rejected on review: it was the least materially committed world in the hand, white and hairlines and type, and built faithfully it could only resolve into a well-typeset document. The Job Ticket was taken from the same hand in its place, where it had already been called the right ballpark.

`.impeccable/mocks/this-week-job-ticket.png` is the approved comp for this world. The rest of the hand, their prompts and their approval records sit alongside it, and the direction contract is in `.impeccable/surfaces/src-app-page-tsx.md`.
