# The daily run plans from committed history, so a browser tick stays in that browser

Ticking a Task in This Week writes an Occurrence to that browser's IndexedDB. The daily run never reads it. `scripts/generate.ts` hands the Planner `seedOccurrences`, parsed from `src/seed/occurrences.json`, and that committed list is the whole history the published Plan is computed from.

## What a Tick Actually Does

`this-week.tsx` opens the browser Store, writes the Occurrence, then re-reads the history rather than flipping a flag in component state. `listOccurrences` in `src/store/browser.ts` merges the seed half with the browser half, so the box renders checked and stays checked on that device. Completion is derived on every render (CONTEXT.md), and what it derives from is that merged list.

Tomorrow's Plan is computed somewhere else entirely. The run happens on the owner's box, from a checkout, against `src/seed/occurrences.json`. The browser's database is on whatever phone was standing in the yard, and nothing in a static export can reach it.

So a Cadence Rule measures its interval from the most recent Occurrence it can see, and it cannot see a browser one. Tick the fig's spring compost in the browser and the next day's Plan proposes it again. That tick stays on the device that made it, where it keeps the box checked, and the thing deciding what the yard needs never sees it.

## The Decision

Keep the split, and say so here rather than leaving a reader to find it.

Every input to a run is either committed to this repository or fetched from Open-Meteo for a date, and that reproducibility is what the split protects. A history living partly in one reader's browser would make the published answer depend on which device somebody happened to be holding, and no later run could reproduce it.

## What Else Was Considered

A server, or a hosted database behind the tick. It ends the static export, which is the shape the rest of this repo is built around: no runtime, no model call in the browser, no network fetch on the page. It also needs somewhere to keep the coordinates, and ADR 0004 spent its whole argument keeping those out of anything published.

Committing browser Occurrences back from the page. A public site would have to carry a credential that can write to this repository. That is not a trade worth taking for a checkbox.

Dropping the browser store, so a tick does nothing at all. It removes the split by removing half of it, which is the appeal. It also removes the only thing This Week lets a reader do, and it argues against itself: a record of work that disappears is what ADR 0002 refuses for Tasks, and refusing it for Occurrences is the same argument.

An export from the browser that the owner commits into `src/seed/occurrences.json` by hand. This is the one that may yet happen. It needs no runtime and no credential, and it keeps the published history committed. It is not decided here because nothing has needed it yet, and a path nobody uses is a path nobody maintains.

## Consequences

Moving a completed job into the yard's real history means editing `src/seed/occurrences.json`. That is a deliberate act by the owner, on the box holding the checkout, and it is the only route in.

A tick is per device and per browser. The same reader on a phone and on a laptop sees two different sets of checked boxes, and clearing site data clears one of them.

The Away Card records nothing, because it is read-only by design. The household reading it leaves no history behind either way, so this decision changes nothing for them.

The interface does not yet tell the reader any of this. `PERMANENCE_NOTE` in `src/components/this-week/permanence.ts` says a tick cannot be taken back; it does not say the tick stays here. Saying that on the page is follow-up work rather than part of this decision.
