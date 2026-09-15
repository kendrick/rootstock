# A threshold rule says which way it crosses, and a crossing stays crossed

> **Amendment, 2026-09-14.** #48 tested this decision against the real 2026 soil series and found the season fence does not do what the argument below credits it with. `direction` works: the run this ADR is named for, `58, 56, 55`, is declining and no longer fires. The fence does not, because it opens on `02-01` and the first qualifying rise that year runs `02-06` to `02-08`, off a prior day of 48.9F. That is a genuine rising crossing sitting inside the season, so the claim in **What Else Was Considered** that the season fence would catch February does not hold. Which defect counts as the root, and therefore what replaces the fence, is open in #48. Read what follows as the reasoning that shipped rather than as settled.

A Threshold Rule may now declare `direction`, `rising` or `falling`, and a `season` that fences it to part of the year. A directed Rule counts a run only when the calendar day just before it sat strictly on the far side of `value`, so the run is evidence of a crossing rather than of a spell already under way. Both fields are nullable and both default to null, so a Rule naming neither behaves exactly as it does today.

## The Reasoning This Revises

The doc comment on `evaluateThresholdRule` argued permanence from the fall pre-emergent:

> Any qualifying run inside the window fires, not only one ending on `asOf`, and the earliest is the one cited. Soil that sat at or below 70F for three days in early September did not un-cross it because the following week ran warm, and citing the latest run instead would keep re-dating a crossing that happened once.

That is correct for the case it was written about. Autumn cools steadily enough that `lte 70` on soil temperature at 6cm really does get a warm week afterwards that amounts to noise.

Spring does not work that way. North Texas warms in a sawtooth: a February warm spell, a cold front, then another spell. Crabgrass germination tracks sustained warming rather than the first spike to touch the number, so `gte 55` reads a February spike as the crossing and, by the same permanence, never revisits it.

The defect is live in the shipped seed data. `spring-pre-emergent` fires on a February series of 58, 56, 55, which satisfies `gte 55` for three consecutive observed days, and then the readings collapse into the low 40s. The Task that results asks the owner to put down a pre-emergent herbicide weeks early. Its Citation names a real Rule, real dates, and real readings, so nothing a citation check can look at is wrong.

That is what makes this more expensive than an ordinary bug that gets a date wrong. CONTEXT.md opens by promising that every answer cites the rule that produced it and the reading that fired that rule. Here the Citation holds and the Task is wrong.

## The Decision

A run that opens the series, or opens after a gap in the dates, has no day behind it to check, so a directed Rule does not count it. The evidence a crossing needs is the day that sat on the far side, and a run with nothing before it proves only that the yard was already past `value` when somebody started looking.

`season` takes the shape `cadenceRuleSchema` already uses, and it fences two separate dates. It fences the planned date, so a March crossing does not linger on the list in July. It also fences the qualifying run's own first and last day, so a January warm spell ahead of the season never counts as the crossing.

Direction is declared on the Rule rather than inferred from `comparison`. A schema refine pairs `rising` with `gte` and `falling` with `lte`, so the two dead pairings fail at parse.

Permanence survives all of this. Direction and season decide which runs qualify and on which dates the Rule speaks, and neither revokes a crossing that already qualified.

## What Else Was Considered

A monotonicity requirement on the qualifying run would fail `58, 56, 55` and pass `52, 55, 57`. It asks the weather for something steadier than the agronomy needs, since a real warming trend that dips for a single day inside the run would fail it too. It also does not solve February: `52, 55, 57` in February is monotone and still fires early, so the season fence would be needed anyway.

Scoping permanence to `comparison` would make it permanent for `lte` and re-evaluated for `gte`. That was the cheapest change and the least explicit about why. Re-evaluating means a fired Task can un-fire, which CONTEXT.md's Approaching Task entry rules out for forecasts and which ADR 0002's argument about work that vanishes rules out generally. Scoping also hides the agronomy inside a comparison operator, so the Rule data never says which way it crosses.

A second field, `sustainedForDays` beyond `consecutiveDays`, would measure the spell after the run. It delays every verdict by the sustain period, and a long February spell satisfies it anyway. Nor can it tell a crossing from a spell already under way, which is the distinction the defect turns on.

## Consequences

A directed Rule reaches back one day further than its `consecutiveDays`, because the day before the run is part of the evidence. `thresholdLookbackDays` is the single place that arithmetic appears, and both the Planner's window and the seed validator read it.

A Rule whose window opens in the middle of a spell stays silent until the next crossing it can evidence. That is fail-closed on purpose: the alternative is firing on a spell whose beginning nobody observed.

A Task now leaves the list when its season ends, the way a Cadence Task already does. The crossing is not revoked; the Rule simply has nothing to say on that date.

The interface does not render either field yet. A Threshold Rule's summary sentence and the sparkline description still describe it without its direction or its season, which is a follow-up rather than part of this decision.
