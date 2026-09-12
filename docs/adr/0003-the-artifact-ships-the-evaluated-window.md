# The artifact carries the readings the rules looked at, not only the triggers

The published Artifact holds the window of DailyAggregates the Rules actually evaluated, roughly a month of them, on the Plan itself. It does not hold only the firing values, and it does not hold the whole fetched history.

## The two ends, and why the middle wins

The daily run pulls about three months of trailing data and a week of forecast from Open-Meteo, which returns both in one request. What lands in the committed JSON is a separate question.

Shipping only the triggers is the smallest thing that works. `soil temperature at 6cm averaged 56.2°F for three days ending March 4` is a complete Citation on its own, and the payload is a few dozen bytes.

It is also the version where the app builds a citation system and then withholds the evidence. The site can never say more than the run decided, so a user who wants to know how close the second pre-emergent window is has nowhere to look. Every follow-up question needs another daily run to answer.

Shipping everything removes that limit and costs a few hundred kilobytes of JSON on every page load, most of it hourly readings at depths no Rule consults.

It also does not buy what it appears to buy. The argument for it is a future browser-only mode that re-evaluates Rules on the client. But Open-Meteo sends `Access-Control-Allow-Origin: *`, verified against a live request, so that browser would fetch its own current data rather than reading stale history out of a published file.

## What the window is for

Thirty daily values per variable is small enough to ignore and large enough to draw.

That is the real return: a sparkline of soil temperature with the Rule's threshold drawn across it and the firing day marked. It turns the Citation from a sentence into a picture, and it answers "how close are we" without another run. For a project whose entire claim is that its reasoning is inspectable, showing the series the reasoning read is the difference between asserting that and demonstrating it.

## A note on wording

This record predates `CONTEXT.md`, and originally called the window a run of Observations and placed it "alongside the Plan". The glossary written since separates Observation, one hourly reading, from DailyAggregate, one day reduced from many of them, and the window is the latter. It also lives on `Plan.window` rather than beside the Plan, because only the Planner run that produced a Plan knows which days it read.

The decision is unchanged. Only the words are, and they are corrected above rather than left to contradict the glossary.

The forecast span is a second correction of the same kind. This record said a fortnight because that is what the endpoint appeared to offer. Building the adapter established otherwise. `soil_temperature_6cm` forecasts about seven days, while precipitation runs a clean sixteen, so a fortnight of soil temperature was never available to ship. The run asks seven days of every series, because a response carrying nulls counts as a failure, and a per-variable horizon would weaken that rule to buy forecast days no Rule reads. The rain Guard looks two days out.

## Consequences

The window is a judgment and it will be wrong eventually. A Threshold Rule that needs a longer run of days than the window carries will produce a Citation the interface cannot draw, and nothing currently detects that. The first Rule that reaches further back than the window ships is the one that finds this, and the fix is to widen the window rather than to shorten the Rule.

The Artifact grows with the number of variables as well as their span. Adding soil moisture and rainfall to the window roughly triples it. That is still small, and it means the window is a budget somebody has to spend deliberately.

The published file now contains readings for a location, which is a second reason the Artifact carries no coordinates. See [0004](0004-coordinates-never-enter-the-repository.md).
