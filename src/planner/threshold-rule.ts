import type { DailyAggregate } from './plan';
import type { RuleVerdict } from './planner';
import type { ThresholdRule } from '@/rules/rule';
import { daysBetween } from './dates';

/** The first and last day of one run that satisfied a Rule. Only the ends travel onward: a Citation names a span, never the days inside it. */
interface Run {
	from: DailyAggregate;
	to: DailyAggregate;
}

/**
 * Both comparisons include the boundary, so a Rule written at 70F counts the
 * day soil temperature reads exactly 70. That is the off-by-one a reader is
 * most likely to assume the other way round.
 */
function satisfies(day: DailyAggregate, rule: ThresholdRule): boolean {
	return rule.comparison === 'gte' ? day.value >= rule.value : day.value <= rule.value;
}

/**
 * `depthCm` matches by identity, so a Rule written for 6cm never counts a day
 * taken at the surface and never counts one whose depth is null. Those are
 * three separate series that happen to share a variable, and folding them
 * together would build a run out of days that were never comparable.
 *
 * Nothing in the parameter type promises an order. The Planner's own window
 * happens to arrive date-ascending out of `toDailyAggregates`, and a run
 * counter leaning on that would miscount the first time a window is stitched
 * together from two fetches. It would miscount quietly, too: days out of order
 * look like a missing day, and a missing day reads as a broken run. Sorting
 * the filtered copy leaves the caller's array alone.
 */
function seriesFor(rule: ThresholdRule, window: DailyAggregate[]): DailyAggregate[] {
	return window
		.filter(day =>
			day.variable === rule.variable
			&& day.depthCm === rule.depthCm
			&& day.aggregate === rule.aggregate,
		)
		.sort((left, right) => left.date < right.date ? -1 : left.date > right.date ? 1 : 0);
}

/**
 * The earliest run of `consecutiveDays` days that all satisfy the Rule and sit
 * on adjacent calendar dates, or null when the days hold no such run.
 *
 * Adjacency is asked of `daysBetween` rather than of the array positions,
 * because a missing day is invisible to an index. A series that skips
 * September 3rd still has the 2nd and the 4th sitting next to each other, and
 * counting positions would read those as two days in a row. That false run is
 * the whole thing a Rule asking for three days of held temperature exists to
 * rule out.
 *
 * A series shorter than `consecutiveDays` returns null, however close it came.
 * ADR 0003 fixes the direction of the repair: widen the window the Planner
 * carries, never shorten the Rule to fit the days on hand.
 */
function firstRun(days: DailyAggregate[], rule: ThresholdRule): Run | null {
	let start: DailyAggregate | null = null;
	let length = 0;
	let previous: DailyAggregate | null = null;

	for (const day of days) {
		const adjacent = previous !== null && daysBetween(previous.date, day.date) === 1;

		if (!satisfies(day, rule)) {
			start = null;
			length = 0;
		}
		else if (start !== null && adjacent) {
			length += 1;
		}
		else {
			start = day;
			length = 1;
		}

		previous = day;

		if (start !== null && length === rule.consecutiveDays) {
			return { from: start, to: day };
		}
	}

	return null;
}

/**
 * Decides whether one Threshold Rule has fired, is on its way to firing, or
 * has nothing to say about the days it was handed.
 *
 * A forecast day cannot fire a Rule. Firing is a claim that the yard already
 * crossed the line, and work published on that claim has to stay published:
 * forecasts get revised every morning, so a fired status resting on one would
 * have to disappear the day the model changed its mind, and a Task that
 * vanishes is indistinguishable from one nobody ever thought of. A forecast
 * crossing belongs in the `approaching` status, which says the same thing
 * without claiming it already happened.
 *
 * So the fired scan runs over a list the forecast days have already been
 * removed from, instead of over the whole series with a flag threaded through
 * the run counter. No branch and no flag can carry a forecast day to the fired
 * verdict, and that guarantee costs nothing to keep, where one resting on
 * every future caller passing the right flag would cost attention forever.
 * Days dated past `asOf` come out with the forecast days: a day the Planner
 * has not reached yet is not evidence, whatever its basis says.
 *
 * Any qualifying run inside the window fires, not only one ending on `asOf`,
 * and the earliest is the one cited. Soil that sat at or below 70F for three
 * days in early September did not un-cross it because the following week ran
 * warm, and citing the latest run instead would keep re-dating a crossing that
 * happened once.
 */
export function evaluateThresholdRule(
	rule: ThresholdRule,
	window: DailyAggregate[],
	asOf: string,
): RuleVerdict {
	const series = seriesFor(rule, window);

	const evidence = series.filter(day => day.basis === 'observed' && day.date <= asOf);
	const observedRun = firstRun(evidence, rule);
	if (observedRun !== null) {
		return {
			fires: true,
			status: 'fired',
			titleSuffix: null,
			citation: {
				kind: 'threshold',
				variable: rule.variable,
				depthCm: rule.depthCm,
				aggregate: rule.aggregate,
				from: observedRun.from.date,
				to: observedRun.to.date,
			},
		};
	}

	/*
	 * The same scan again, now with the forecast days in. A run here opens on
	 * the trailing observed days and closes on a forecast one, which is the
	 * ordinary shape of a Rule about to be satisfied.
	 *
	 * The two halves are bounded from opposite sides, and between them they
	 * buy the property CONTEXT.md asks of an Approaching Task: its Citation
	 * names a day that is forecast to satisfy the Rule, never one that already
	 * did. An observed day is evidence only up to `asOf`, because the Planner
	 * has not reached past that date whatever a reading claims. A forecast day
	 * counts only from `asOf` forward, because a forecast for a day already
	 * gone is a leftover from an earlier fetch and would date a crossing in the
	 * past.
	 *
	 * That makes the closing day of any run found here a forecast day, and it
	 * falls out rather than being checked for. A run closing on an observed day
	 * would consist entirely of observed days at or before `asOf` (the days are
	 * adjacent and ascending, and stale forecast days are gone), so the scan
	 * above would already have fired it.
	 *
	 * Dropping a stale forecast day leaves a hole the run counter reads as a
	 * break, which is the honest answer: a day whose only row is a forecast is
	 * a day nobody observed, and a run has no business claiming continuity
	 * through it.
	 */
	const projection = series.filter(day =>
		day.basis === 'observed' ? day.date <= asOf : day.date >= asOf,
	);

	const projectedRun = firstRun(projection, rule);
	if (projectedRun !== null) {
		return {
			fires: true,
			status: 'approaching',
			titleSuffix: null,
			citation: {
				kind: 'threshold-projection',
				variable: rule.variable,
				depthCm: rule.depthCm,
				aggregate: rule.aggregate,
				projectedDate: projectedRun.to.date,
			},
		};
	}

	return { fires: false };
}
