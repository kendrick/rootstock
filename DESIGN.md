# Design

<!-- impeccable:design-schema 1 -->

The world is a gridded type specimen. The construction grid that builds the page stays visible on it, and the evidence behind every Task sits on a line of its own where nothing can fold it away.

That second property is the one this design exists for. The category answer to provenance is a "Why this?" link, which promises the reasoning exists rather than showing it. This product's claim is that nothing on the page was invented, so the proof renders under the instruction it backs, every time.

## Ground and Ink

| Role          | Light     | Dark      | Notes                                                                                                                                                                                |
| ------------- | --------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--ground`    | `#f6f7f8` | `#0c0d0f` | Sampled from the approved comp rather than typed from the prompt that made it. The prompt asked for pure white; the render settled on an off-white that holds up better under glare. |
| `--ink`       | `#0b0b0c` | `#f1f2f4` | Body and display.                                                                                                                                                                    |
| `--grid-line` | `#c9def7` | `#1e2a44` | The construction grid. Faint enough that body copy on it still clears 4.5:1.                                                                                                         |
| `--accent`    | `#1156f8` | `#6f9bff` | 5.93:1 on light, 7.4:1 on dark. Same hue in both, so "cited" reads as one colour across schemes.                                                                                     |
| `--muted`     | `#5c6166` | `#9aa1aa` | 5.12:1. The comp drew secondary text at `#999b9f`, which measures 2.52:1 and fails 1.4.3. A comp is a north star for composition and carries no authority over contrast.             |
| `--rule`      | `#0b0b0c` | `#f1f2f4` | The only divider in this world.                                                                                                                                                      |

The use scene picked the ground, and the category had no say in it. This page is read outdoors in full Texas sun on a phone held one-handed, where a dark shell loses to reflected skylight. Dark mode follows the reader's system and offers no toggle, because the ambient light the phone already measures is what decides.

Four things earn the accent and nothing else does: the active nav underline, a recorded control, the evidence line, and the open count. Colour never decorates here.

## Type

Three faces, and two of them were chosen by measurement. `impeccable font-match` measures cap height, advance width and stroke density off the approved comp, then ranks a catalogue against those numbers.

Economica 400 and 700 carry display, job names and every label, having won that ranking. It has no variable axis, so both weights ship explicitly. Assistant carries body copy and won the ranking for the instruction region.

Atkinson Hyperlegible Mono carries evidence only, and is the one face chosen against the ranking. `PRODUCT.md` records a binding need for characters that stay distinct where rule ids, dates and product-label figures are read down a column and compared with their neighbours, which describes the evidence line and nothing else on the page. The metric winner for that region was unusable anyway: at the spec's grid resolution the region boxes could not separate a title from its instruction from its evidence, so the measurement came back mixed and ranked serif faces against a monospaced line.

Sizes come from the comp's measured cap heights, expressed as `clamp()`. The upper bound is the comp's own 1024px frame, the lower bound is what stays readable at 390px, and the middle tracks the viewport so display type keeps its proportion to the grid instead of collapsing into body copy on a phone.

`--text-detail` is a real step on that scale, carrying Guard notes, Citation rows and Advisories. Tailwind's `text-sm` sat at 14px beside 29px body copy, a jump large enough that the two read as different pages.

Figures are tabular everywhere, because every number on this page is a measurement compared against the one above it.

## What This World Does Not Have

There are no cards, shadows, rounded corners, or icons standing in for labels, and nothing sits on a raised surface.

Division is a hairline that lands on a grid line, and that hairline is what identifies a Task. Issues #62 and #65 raised the requirement, WCAG 1.4.11's 3:1 where a border is what identifies a component, and a raised surface with a 4.12:1 border was as close as a shell of stacked zinc surfaces could get. `--rule` on `--ground` measures roughly 18.9:1 and needs no surface to help it.

The surface also ships no rasters at all. It is flat shape systems, hairlines and type the whole way down, so the static export sends no images and a reader on cell signal in a yard waits for nothing.

## Components

### The Tally Band

The week's load as a strip of grid cells: filled for recorded, outlined for open, faint for the rest of the band. It holds 13 cells whatever the week contains, so the fill itself is the comparison and a heavy week reads as heavy against the memory of a light one. It is not a capacity and not a limit, and it overflows rather than truncating, because a Task the display dropped would be indistinguishable from one nobody thought of. It carries `aria-hidden`: the sentence beneath states the same number exactly, so the text is the accessible answer and the band is the fast one.

### The Task Row

Job name first, then the target right-aligned, then the instruction, then the evidence in accent mono. That order was tested. The rejected comp variation led with evidence and made the largest element on the screen read `NO OCCURRENCE`, which is the absence of evidence, while the work itself sat third.

### NOT THIS WEEK

Lists the Rules the yard holds that no evidence lit. This is the one part of the page that argues ADR 0001 without saying anything: the rule set is fixed, the Planner invents nothing, and evidence alone decides which Rules speak today. Guards are excluded, because a Guard creates no work and so has nothing to be silent about.

### The GRID Control

Switches the construction grid off, and does nothing else. It exists for accessibility rather than preference: a pattern held permanently behind body copy is a real problem for visual stress and low vision, and this world puts one there by design. The choice persists, an inline script applies it before first paint so it never flashes, and `prefers-contrast: more` removes the grid without anyone asking. The whole rule set belongs to `/rules`, and full citation detail to the disclosure each Task already carries.

## Motion

One authored moment, belonging to the only action that cannot be taken back. Recording work writes an append-only Occurrence, there is no undo, and the page refuses one out loud. So the control commits instead of toggling: the fill runs out from the centre on an exponential ease-out, which reads as something landing rather than something switching. It plays once, on the way in, and has no reverse because the Occurrence has none either. Under `prefers-reduced-motion` the state arrives immediately and without the travel, because the information was never in the movement.

Nothing else on the page moves. A second animated thing would make this one ordinary.

## Print

Paper has one scheme. The Away Card is printed and read in a hand, so print pins the light values whatever the screen was doing. The grid does not print at all: on screen it is an armature, and on paper it is noise a reader cannot switch off.

## Migration Debt

`globals.css` carries the old shell's token vocabulary (`--color-card`, `--color-muted-foreground`, and the rest) remapped onto this world. Yard, Rules and the Away Card have not had their own passes yet and still speak those names, and dropping the tokens would leave three routes unstyled while a fourth looked finished. They are not a second palette, since every one resolves to a value above. Each dies as its surface is redesigned, and the last one out takes the block with it.

## Provenance

The direction came from a four-round roll (seed `af87c25e`, re-roll 3, bolder register), chosen over Struck Cathode on sunlight legibility and on clearing WCAG 2.2 AA without a fight. The comps, their prompts and their approval records sit under `.impeccable/`, and the direction contract is in `.impeccable/surfaces/src-app-page-tsx.md`.
