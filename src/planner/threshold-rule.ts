import type { DailyAggregate } from './plan';
import type { RuleVerdict } from './planner';
import type { ThresholdRule } from '@/rules/rule';
import { daysBetween, isWithinMonthDayRange } from './dates';

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
 * Whether the day before a candidate run proves the series arrived from the
 * far side of `value`. An undirected Rule asks for no such proof.
 *
 * `before` is whichever day sits in front of the candidate in the scanned
 * series, and that is not always the calendar day before the run opens. A
 * series that opens on the run, or that skips the day in front of it, hands
 * over nothing or hands over a day from further back. Neither proves a
 * crossing.
 *
 * The comparison is strict on purpose. A prior day reading exactly `value`
 * already satisfies the Rule, so it would have been inside the run rather than
 * in front of it, and counting it would let a spell already underway pass as a
 * crossing.
 */
function crossedFrom(from: DailyAggregate, before: DailyAggregate | null, rule: ThresholdRule): boolean {
	if (rule.direction === null) {
		return true;
	}

	if (before === null || daysBetween(before.date, from.date) !== 1) {
		return false;
	}

	return rule.direction === 'rising' ? before.value < rule.value : before.value > rule.value;
}

/** Whether one day falls in the part of the year the Rule speaks about. A Rule with no season speaks about the whole year. */
function insideSeason(day: DailyAggregate, rule: ThresholdRule): boolean {
	return rule.season === null || isWithinMonthDayRange(day.date, rule.season.start, rule.season.end);
}

/**
 * `noUncheckedIndexedAccess` types every index read as possibly absent, and
 * the run counter's arithmetic keeps the index it passes in range. Like
 * `first` in `aggregate.ts`, the impossible case throws here rather than
 * leaking an `undefined` into a Citation that would then name no dates.
 */
function dayAt(days: DailyAggregate[], index: number): DailyAggregate {
	const found = days[index];
	if (found === undefined) {
		throw new Error(`threshold run counter reached index ${index}, which is outside the series it was counting`);
	}
	return found;
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
 * The earliest run of `consecutiveDays` days that all satisfy the Rule, sit on
 * adjacent calendar dates, and clear what `direction` and `season` ask of
 * them, or null when the days hold no such run.
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
 *
 * A spell longer than `consecutiveDays` holds more than one candidate, so the
 * scan tests the trailing `consecutiveDays` on every day the run is long
 * enough, and a rejected candidate leaves the run standing. Both of those
 * matter to a Rule carrying a season. Days from January 30th through February
 * 3rd, all satisfying, hold a run inside a season that opens on the 1st, even
 * though the candidate the spell opens with starts two days early. A scan that
 * stopped at the first candidate would answer "no run" for a series that
 * plainly holds one.
 */
function firstRun(days: DailyAggregate[], rule: ThresholdRule): Run | null {
	let length = 0;
	let previous: DailyAggregate | null = null;

	for (const [index, day] of days.entries()) {
		const adjacent = previous !== null && daysBetween(previous.date, day.date) === 1;

		if (!satisfies(day, rule)) {
			length = 0;
		}
		else if (length > 0 && adjacent) {
			length += 1;
		}
		else {
			length = 1;
		}

		previous = day;

		if (length < rule.consecutiveDays) {
			continue;
		}

		// A run is a contiguous stretch of the array, so the candidate closing here
		// opens `consecutiveDays` positions back and the position before that holds
		// whatever the series has in front of it. Reading that neighbour out of the
		// array, rather than tracking a pointer alongside the run, leaves
		// `crossedFrom` to judge adjacency for itself.
		const from = dayAt(days, index - rule.consecutiveDays + 1);
		const before = days[index - rule.consecutiveDays] ?? null;

		if (crossedFrom(from, before, rule) && insideSeason(from, rule) && insideSeason(day, rule)) {
			return { from, to: day };
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
 * happened once. That argument is about the fall, where it holds. Autumn cools
 * steadily enough that a warm week behind the crossing is noise.
 *
 * Spring is not the mirror image. North Texas warms in a sawtooth—a February
 * spell, a front, another spell—and crabgrass germinates on sustained warmth
 * rather than on the first spike to touch the number, so in the rising
 * direction a crossing really can be un-crossed. A pre-emergent put down on
 * the February spell lands weeks early, which is the failure the timing exists
 * to prevent.
 *
 * `direction` and `season` answer the spring case without taking the
 * permanence back. `direction` asks a run for evidence that the series arrived
 * from the far side of `value`, so the declining tail of a spell already
 * underway does not read as a crossing. `season` fences two things. One is the
 * dates a qualifying run may carry, which tells a January warm spell from a
 * spring one. The other is the dates the Rule speaks on at all. That is the
 * `asOf` check below, and it keeps a March crossing off the Plan in July.
 *
 * Neither field revokes a crossing that already qualified. They decide which
 * runs qualify in the first place, and a Task that fired stays fired.
 */
export function evaluateThresholdRule(
	rule: ThresholdRule,
	window: DailyAggregate[],
	asOf: string,
): RuleVerdict {
	if (rule.season !== null && !isWithinMonthDayRange(asOf, rule.season.start, rule.season.end)) {
		return { fires: false };
	}

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
